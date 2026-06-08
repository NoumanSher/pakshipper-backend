// d:/projects/pakshipper-backend/scripts/sync-platform-to-tenant.js
// ------------------------------------------------------------
// Copies core collections from the ORIGINAL (pakshipper) DB
// into the tenant DB (pakshipper_tenant_sandbox).
// ------------------------------------------------------------

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectToPlatformDB, getPlatformConnection } from '../config/platformConnection.js';
import { getTenantConnection } from '../config/connectionPool.js';
import { compileTenantModels } from '../models/registry.js';
import { decrypt } from '../utils/encryption.js';

// ------------------------------------------------------------
// 👉 TENANT_SLUG – the slug of the tenant to sync into.
// ------------------------------------------------------------
const TENANT_SLUG = 'pakshipper-store';

// ------------------------------------------------------------
// 👉 SOURCE_MONGO_URL – the original "pakshipper" DB that has
//    all your actual products, categories, orders, etc.
//    Falls back to MONGO_URL_PROD from .env
// ------------------------------------------------------------
const SOURCE_MONGO_URL = process.env.MONGO_URL_PROD
  || process.env.MONGO_URL.replace('pakshipper_platform', 'pakshipper');

async function main() {
  console.log('🚀 Starting sync for tenant slug:', TENANT_SLUG);
  console.log('📦 Source DB URL:', SOURCE_MONGO_URL.replace(/:[^:@]+@/, ':****@')); // mask password

  // 0️⃣ Connect to Platform DB (to look up the tenant)
  await connectToPlatformDB();
  const platformConn = getPlatformConnection();

  // 1️⃣ Look up the tenant document
  const Tenant = platformConn.model('Tenant');
  const tenant = await Tenant.findOne({ slug: TENANT_SLUG }).lean();
  if (!tenant) throw new Error(`Tenant with slug "${TENANT_SLUG}" not found`);
  console.log(`✅ Found tenant: ${tenant.name} (${tenant._id})`);

  // 2️⃣ Connect to the SOURCE database (original pakshipper DB with real data)
  console.log('🔌 Connecting to source (original) database...');
  const sourceConn = await mongoose.createConnection(SOURCE_MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  console.log('🟢 Connected to source database.');

  // Register tenant models on the source connection so we can query them
  compileTenantModels(sourceConn);

  // 3️⃣ Open a connection to the tenant's isolated DB
  const tenantConnString = decrypt(tenant.database.connectionString);
  const tenantConn = await getTenantConnection(tenant._id.toString(), tenantConnString);

  // 4️⃣ Collections to copy and their Mongoose model names
  const collectionsToSync = [
    { collection: 'products',        model: 'Product' },
    { collection: 'categories',      model: 'ParentCategories' },
    { collection: 'childcategories', model: 'ChildCategories' },
    { collection: 'settings',        model: 'Settings' },
    { collection: 'postorders',      model: 'PostOrder' },
    { collection: 'users',           model: 'User' },
    { collection: 'reviews',         model: 'Review' },
  ];

  for (const { collection, model } of collectionsToSync) {
    try {
      const SourceModel = sourceConn.model(model);
      const TenantModel = tenantConn.model(model);

      const docs = await SourceModel.find().lean();
      if (!docs.length) {
        console.log(`⚙️  No documents in source "${collection}" (model: ${model})`);
        continue;
      }

      // Remove __v but keep _id for referential integrity
      const sanitized = docs.map(({ __v, ...rest }) => rest);

      // Clear tenant collection first, then insert
      await TenantModel.deleteMany({});
      await TenantModel.insertMany(sanitized, { ordered: false });
      console.log(`✅ Synced ${sanitized.length} "${collection}" docs → tenant "${TENANT_SLUG}"`);
    } catch (err) {
      console.error(`❌ Error syncing "${collection}" (model: ${model}):`, err.message);
    }
  }

  // 5️⃣ Quick verification
  try {
    const productCount  = await tenantConn.model('Product').countDocuments();
    const categoryCount = await tenantConn.model('ParentCategories').countDocuments();
    const orderCount    = await tenantConn.model('PostOrder').countDocuments();
    const userCount     = await tenantConn.model('User').countDocuments();
    const reviewCount   = await tenantConn.model('Review').countDocuments();
    console.log(`\n🔎 Tenant DB verification:`);
    console.log(`   Products   : ${productCount}`);
    console.log(`   Categories : ${categoryCount}`);
    console.log(`   Orders     : ${orderCount}`);
    console.log(`   Users      : ${userCount}`);
    console.log(`   Reviews    : ${reviewCount}`);
  } catch (e) {
    console.warn('⚠️  Could not run verification:', e.message);
  }

  // Clean up source connection
  await sourceConn.close();
  console.log('\n🎉 Sync completed for tenant slug:', TENANT_SLUG);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});

// scripts/reset-merchant-user.js
// Creates or resets the merchant owner account in the tenant DB

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { connectToPlatformDB, getPlatformConnection } from '../config/platformConnection.js';
import { getTenantConnection } from '../config/connectionPool.js';
import { compileTenantModels } from '../models/registry.js';
import { decrypt } from '../utils/encryption.js';

const TENANT_SLUG = 'pakshipper-store';

// ✏️ Change these credentials as needed
const MERCHANT_EMAIL    = 'merchant@sandbox.com';
const MERCHANT_PASSWORD = 'merchant123';
const MERCHANT_NAME     = 'Sandbox Merchant';

async function main() {
  console.log('🔧 Resetting merchant user for tenant:', TENANT_SLUG);

  // Connect to platform DB to find the tenant
  await connectToPlatformDB();
  const platformConn = getPlatformConnection();

  const Tenant = platformConn.model('Tenant');
  const tenant = await Tenant.findOne({ slug: TENANT_SLUG }).lean();
  if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" not found`);
  console.log(`✅ Found tenant: ${tenant.name}`);

  // Connect to the tenant DB
  const tenantConnString = decrypt(tenant.database.connectionString);
  const tenantConn = await getTenantConnection(tenant._id.toString(), tenantConnString);
  compileTenantModels(tenantConn);

  const User = tenantConn.model('User');
  const Role = tenantConn.model('Role');

  // Find or create the 'owner' role
  let ownerRole = await Role.findOne({ name: 'owner' }).lean();
  if (!ownerRole) {
    ownerRole = await Role.create({
      name: 'owner',
      displayName: 'Store Owner',
      level: 90,
      permissions: [],
    });
    console.log('✅ Created "owner" role');
  } else {
    console.log('✅ Found existing "owner" role (level:', ownerRole.level, ')');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(MERCHANT_PASSWORD, 10);

  // Upsert the merchant user
  const result = await User.findOneAndUpdate(
    { email: MERCHANT_EMAIL.toLowerCase() },
    {
      $set: {
        name: MERCHANT_NAME,
        username: MERCHANT_NAME,
        email: MERCHANT_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: ownerRole._id,
        isVerified: true,
        isActive: true,
      },
    },
    { upsert: true, new: true, runValidators: false }
  );

  console.log('\n🎉 Merchant user ready!');
  console.log('   📧 Email   :', MERCHANT_EMAIL);
  console.log('   🔑 Password:', MERCHANT_PASSWORD);
  console.log('   👤 Name    :', MERCHANT_NAME);
  console.log('   🆔 User ID :', result._id);
  console.log('\n👉 Login at: http://admin.sandbox.localhost:3001/login');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});

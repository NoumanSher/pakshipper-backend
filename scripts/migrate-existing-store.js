import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectToPlatformDB } from "../config/platformConnection.js";
import { getTenantConnection } from "../config/connectionPool.js";
import TenantService from "../services/tenantService.js";

dotenv.config();

// Load models to compile schemas on source connection
import { ProductSchema } from "../models/products.js";
import { postOrderSchema } from "../models/post-order.js";
import { ParentCategoriesSchema } from "../models/categories.js";
import { ChildCategoriesSchema } from "../models/child-categories.js";
import { userSchema } from "../models/user-schema.js";
import { addressSchema } from "../models/address.js";
import { ReviewSchema } from "../models/Review.js";
import { notificationSchema } from "../models/notification.js";
import { settingsSchema } from "../models/settings.js";
import { UserCartSchema } from "../models/UserCart.js";

const migrateStore = async () => {
  console.log("🚀 Starting Store Migration to Multi-Tenant Database...");
  
  const sourceUri = process.env.SOURCE_MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/pakshipper";
  const tenantSlug = process.env.TENANT_SLUG || "pakshipper-main";
  const tenantDbUri = process.env.TENANT_DB_URI || "mongodb://127.0.0.1:27017/pakshipper_tenant_main";
  const tenantDbName = process.env.TENANT_DB_NAME || "pakshipper_tenant_main";
  const ownerEmail = (process.env.MERCHANT_OWNER_EMAIL || "owner@pakshipper.com").toLowerCase();
  const ownerName = process.env.MERCHANT_OWNER_NAME || "Main Merchant";
  const ownerPassword = process.env.MERCHANT_OWNER_PASSWORD || "merchantpassword123";

  console.log(`🔌 Source Database: ${sourceUri}`);
  console.log(`🏢 Target Tenant Slug: ${tenantSlug}`);
  console.log(`🔌 Target Tenant DB: ${tenantDbUri}`);
  console.log(`📧 Target Owner Email: ${ownerEmail}`);

  let platformDb, sourceConn, targetConn;

  try {
    // 1. Connect to Platform Database
    platformDb = await connectToPlatformDB();
    const Tenant = platformDb.model("Tenant");
    const PlatformAdmin = platformDb.model("PlatformAdmin");

    // Get a platform admin or fallback to creating a system one
    let systemAdmin = await PlatformAdmin.findOne({ role: "super_admin" });
    if (!systemAdmin) {
      console.log("ℹ️ No Platform Super Admin found. Seeding a system admin for reference...");
      const hashedPassword = await mongoose.model("PlatformAdmin").hashPassword?.("adminpassword123") || 
                             await import("bcrypt").then(b => b.default.hash("adminpassword123", 10));
      systemAdmin = new PlatformAdmin({
        email: "system-migration@pakshipper.com",
        username: "SystemMigration",
        password: hashedPassword,
        role: "super_admin",
        isActive: true
      });
      await systemAdmin.save();
    }

    // Check if tenant already exists
    let tenant = await Tenant.findOne({ slug: tenantSlug });
    if (tenant) {
      console.log(`ℹ️ Tenant with slug "${tenantSlug}" already exists. We will use the existing tenant.`);
    } else {
      console.log(`➕ Provisioning new Tenant record for "${tenantSlug}"...`);
      const tenantData = {
        name: "PakShipper Main Store",
        slug: tenantSlug,
        domains: [
          { domain: "main.localhost:3000", type: "subdomain", isPrimary: true }
        ],
        database: {
          connectionString: tenantDbUri,
          name: tenantDbName
        },
        config: {
          cors: {
            allowedOrigins: ["http://localhost:3000", "http://main.localhost:3000", "http://admin.main.localhost:3000"]
          },
          frontendUrl: "http://main.localhost:3000",
          merchantPanelUrl: "http://admin.main.localhost:3000"
        }
      };

      const ownerData = {
        name: ownerName,
        email: ownerEmail,
        password: ownerPassword
      };

      tenant = await TenantService.provisionTenant(tenantData, ownerData, systemAdmin._id);
      console.log(`✅ Tenant record provisioned successfully!`);
    }

    // 2. Connect to Source (Original Single-Tenant) Database
    console.log("🔌 Connecting to Source Database...");
    sourceConn = await mongoose.createConnection(sourceUri).asPromise();
    console.log("✅ Connected to Source Database.");

    const SourceProduct = sourceConn.model("Product", ProductSchema);
    const SourcePostOrder = sourceConn.model("PostOrder", postOrderSchema);
    const SourceParentCategory = sourceConn.model("ParentCategories", ParentCategoriesSchema);
    const SourceChildCategory = sourceConn.model("ChildCategories", ChildCategoriesSchema);
    const SourceUser = sourceConn.model("User", userSchema);
    const SourceAddress = sourceConn.model("Address", addressSchema);
    const SourceReview = sourceConn.model("Review", ReviewSchema);
    const SourceNotification = sourceConn.model("Notification", notificationSchema);
    const SourceSettings = sourceConn.model("Settings", settingsSchema);
    const SourceUserCart = sourceConn.model("UserCart", UserCartSchema);

    // 3. Connect to Target Tenant Database
    console.log("🔌 Connecting to Target Tenant Database...");
    const { decrypt } = await import("../utils/encryption.js");
    const decryptedConnectionString = decrypt(tenant.database.connectionString);
    targetConn = await getTenantConnection(tenant._id.toString(), decryptedConnectionString);
    console.log("✅ Connected to Target Tenant Database.");

    const TargetProduct = targetConn.model("Product");
    const TargetPostOrder = targetConn.model("PostOrder");
    const TargetParentCategory = targetConn.model("ParentCategories");
    const TargetChildCategory = targetConn.model("ChildCategories");
    const TargetUser = targetConn.model("User");
    const TargetAddress = targetConn.model("Address");
    const TargetReview = targetConn.model("Review");
    const TargetNotification = targetConn.model("Notification");
    const TargetSettings = targetConn.model("Settings");
    const TargetUserCart = targetConn.model("UserCart");
    const TargetRole = targetConn.model("Role");

    // Fetch Target Roles for mapping
    const roles = await TargetRole.find({});
    const rolesMap = roles.reduce((acc, r) => {
      acc[r.name] = r._id;
      return acc;
    }, {});

    console.log(`🔑 Available Target Roles: ${Object.keys(rolesMap).join(", ")}`);

    // 4. Begin Data Migration
    
    // A. Migrate Users
    console.log("\n👥 Migrating Users...");
    const sourceUsers = await SourceUser.find({});
    console.log(`Found ${sourceUsers.length} users in source.`);
    let userMigratedCount = 0;
    
    for (const sUser of sourceUsers) {
      const userEmail = sUser.email.toLowerCase();
      // Check if user already exists in target
      const existingTargetUser = await TargetUser.findOne({ email: userEmail });
      if (existingTargetUser) {
        console.log(`   - User ${userEmail} already exists in target. Skipping.`);
        continue;
      }

      // Map role
      let roleId = rolesMap.customer; // default
      if (userEmail === ownerEmail) {
        roleId = rolesMap.owner;
      } else if (sUser.role === "admin") {
        roleId = rolesMap.store_admin;
      } else if (sUser.role === "manager") {
        roleId = rolesMap.manager;
      }

      const userData = sUser.toObject();
      delete userData._id; // Let mongoose generate a new one or keep the same ID?
      // Keeping the SAME ID is crucial to preserve foreign key references (orders, reviews, etc.)
      const newTargetUser = new TargetUser({
        ...sUser.toObject(),
        role: roleId,
      });

      await newTargetUser.save();
      userMigratedCount++;
    }
    console.log(`✅ Migrated ${userMigratedCount} users.`);

    // B. Migrate Parent Categories
    console.log("\n📁 Migrating Parent Categories...");
    const sourceParentCats = await SourceParentCategory.find({});
    console.log(`Found ${sourceParentCats.length} parent categories.`);
    for (const cat of sourceParentCats) {
      await TargetParentCategory.findOneAndUpdate(
        { _id: cat._id },
        cat.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated parent categories.`);

    // C. Migrate Child Categories
    console.log("\n📁 Migrating Child Categories...");
    const sourceChildCats = await SourceChildCategory.find({});
    console.log(`Found ${sourceChildCats.length} child categories.`);
    for (const cat of sourceChildCats) {
      await TargetChildCategory.findOneAndUpdate(
        { _id: cat._id },
        cat.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated child categories.`);

    // D. Migrate Products
    console.log("\n📦 Migrating Products...");
    const sourceProducts = await SourceProduct.find({});
    console.log(`Found ${sourceProducts.length} products.`);
    for (const prod of sourceProducts) {
      await TargetProduct.findOneAndUpdate(
        { _id: prod._id },
        prod.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated products.`);

    // E. Migrate Addresses
    console.log("\n📍 Migrating Addresses...");
    const sourceAddresses = await SourceAddress.find({});
    console.log(`Found ${sourceAddresses.length} addresses.`);
    for (const addr of sourceAddresses) {
      await TargetAddress.findOneAndUpdate(
        { _id: addr._id },
        addr.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated addresses.`);

    // F. Migrate Orders
    console.log("\n🧾 Migrating Orders...");
    const sourceOrders = await SourcePostOrder.find({});
    console.log(`Found ${sourceOrders.length} orders.`);
    for (const ord of sourceOrders) {
      await TargetPostOrder.findOneAndUpdate(
        { _id: ord._id },
        ord.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated orders.`);

    // G. Migrate Reviews
    console.log("\n⭐ Migrating Reviews...");
    const sourceReviews = await SourceReview.find({});
    console.log(`Found ${sourceReviews.length} reviews.`);
    for (const rev of sourceReviews) {
      await TargetReview.findOneAndUpdate(
        { _id: rev._id },
        rev.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated reviews.`);

    // H. Migrate Carts
    console.log("\n🛒 Migrating Carts...");
    const sourceCarts = await SourceUserCart.find({});
    console.log(`Found ${sourceCarts.length} carts.`);
    for (const cart of sourceCarts) {
      await TargetUserCart.findOneAndUpdate(
        { _id: cart._id },
        cart.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated carts.`);

    // I. Migrate Settings
    console.log("\n⚙️ Migrating Settings...");
    const sourceSettingsObj = await SourceSettings.findOne({});
    if (sourceSettingsObj) {
      const settingsData = sourceSettingsObj.toObject();
      delete settingsData._id;
      await TargetSettings.findOneAndUpdate(
        {},
        settingsData,
        { upsert: true }
      );
      console.log("✅ Migrated Settings.");
    } else {
      console.log("ℹ️ No Settings document found in source database.");
    }

    // J. Migrate Notifications
    console.log("\n🔔 Migrating Notifications...");
    const sourceNotifications = await SourceNotification.find({});
    console.log(`Found ${sourceNotifications.length} notifications.`);
    for (const notif of sourceNotifications) {
      await TargetNotification.findOneAndUpdate(
        { _id: notif._id },
        notif.toObject(),
        { upsert: true }
      );
    }
    console.log(`✅ Migrated notifications.`);

    console.log("\n🎉 Data Migration Completed Successfully!");
    
    // Close connections
    await sourceConn.close();
    await platformDb.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
    if (sourceConn) await sourceConn.close().catch(() => {});
    if (platformDb) await platformDb.close().catch(() => {});
    process.exit(1);
  }
};

migrateStore();

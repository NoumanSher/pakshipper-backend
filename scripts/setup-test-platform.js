import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { connectToPlatformDB } from "../config/platformConnection.js";
import TenantService from "../services/tenantService.js";

dotenv.config();

const setupTestPlatform = async () => {
  console.log("🚀 Running Platform Test Setup Script...");
  let platformDb;
  try {
    platformDb = await connectToPlatformDB();
    const PlatformAdmin = platformDb.model("PlatformAdmin");
    const Tenant = platformDb.model("Tenant");

    // 1. Clear existing database for clean test environment
    console.log("🧹 Cleaning Platform Admin and Tenants records...");
    await PlatformAdmin.deleteMany({});
    console.log("Deleted all platform admins.");

    const activeTenants = await Tenant.find({});
    for (const tenant of activeTenants) {
      tenant.status = "deleted";
      await tenant.save();
    }
    await Tenant.deleteMany({});
    console.log("Deleted all tenants.");

    // 1.5. Clean the sandbox tenant database if it exists
    try {
      console.log("🧹 Dropping existing sandbox tenant database (pakshipper_tenant_sandbox) for clean re-run...");
      const sandboxDb = platformDb.useDb("pakshipper_tenant_sandbox");
      await sandboxDb.db.dropDatabase();
      console.log("✅ Existing sandbox tenant database dropped successfully.");
    } catch (dbErr) {
      console.log("ℹ️ No existing sandbox tenant database to drop or error dropping: ", dbErr.message);
    }

    // 2. Seed Super Admin
    const email = process.env.PLATFORM_ADMIN_EMAIL || "admin@pakshipper.com";
    const username = process.env.PLATFORM_ADMIN_USERNAME || "SuperAdmin";
    const password = process.env.PLATFORM_ADMIN_PASSWORD || "adminpassword123";

    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = new PlatformAdmin({
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      role: "super_admin",
      isActive: true,
    });

    await superAdmin.save();
    console.log(`✅ Platform Super Admin created successfully!`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);

    // 3. Provision a Default Sandbox Tenant Store for local testing
    console.log("\n🛍️ Provisioning Default Sandbox Store Tenant...");
    
    // Dynamically isolate the tenant database name in the connection string to prevent sharing the platform database
    const platformMongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/pakshipper_platform";
    let sandboxConnString = platformMongoUrl;
    if (platformMongoUrl.includes("pakshipper_platform")) {
      sandboxConnString = platformMongoUrl.replace("pakshipper_platform", "pakshipper_tenant_sandbox");
    } else {
      sandboxConnString = platformMongoUrl.endsWith("/") 
        ? `${platformMongoUrl}pakshipper_tenant_sandbox` 
        : platformMongoUrl.replace(/\/[^\/]+$/, "/pakshipper_tenant_sandbox");
    }

    const sandboxTenantData = {
      name: "Sandbox Store",
      slug: "pakshipper-store",
      domains: [
        { domain: "sandbox.localhost", type: "subdomain", isPrimary: true },
        { domain: "admin.sandbox.localhost", type: "subdomain" },
        { domain: "sandbox.pakshipper.local", type: "subdomain" },
        { domain: "admin.sandbox.pakshipper.local", type: "subdomain" }
      ],
      database: {
        connectionString: sandboxConnString,
        name: "pakshipper_tenant_sandbox",
      },
      config: {
        cors: {
          allowedOrigins: [
            "http://localhost:3000",
            "http://sandbox.localhost:3000",
            "http://admin.sandbox.localhost:3000",
            "http://localhost:3001",
            "http://sandbox.localhost:3001",
            "http://admin.sandbox.localhost:3001"
          ]
        },
        frontendUrl: "http://sandbox.localhost:3000",
        merchantPanelUrl: "http://admin.sandbox.localhost:3000"
      }
    };

    const sandboxOwnerData = {
      name: "Sandbox Merchant",
      email: "merchant@sandbox.com",
      password: "merchantpassword123"
    };

    const newTenant = await TenantService.provisionTenant(
      sandboxTenantData,
      sandboxOwnerData,
      superAdmin._id
    );

    console.log(`✅ Sandbox Tenant Store provisioned successfully!`);
    console.log(`🏷️ Store Name: ${newTenant.name}`);
    console.log(`🔗 Slug: ${newTenant.slug}`);
    console.log(`📧 Owner Email: ${sandboxOwnerData.email}`);
    console.log(`🔑 Owner Password: ${sandboxOwnerData.password}`);
    console.log(`📂 Database: ${sandboxTenantData.database.name}`);

    console.log("\n🎉 Platform Test Setup Completed Successfully!");
    await platformDb.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to setup test platform:", error);
    if (platformDb) {
      await platformDb.close().catch(() => {});
    }
    process.exit(1);
  }
};

setupTestPlatform();

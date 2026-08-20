import dotenv from "dotenv";
dotenv.config();

import { connectToPlatformDB } from "../config/platformConnection.js";
import { getTenantConnection } from "../config/connectionPool.js";
import { decrypt } from "../utils/encryption.js";

async function runMigration() {
  try {
    console.log("Connecting to Platform DB...");
    const platformDb = await connectToPlatformDB();
    const Tenant = platformDb.model("Tenant");
    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants:`, tenants.map(t => t.slug));

    for (const t of tenants) {
      console.log(`\n🏢 Processing tenant: ${t.name} (${t.slug})`);
      const connStr = decrypt(t.database?.connectionString);
      if (!connStr) {
        console.log(`⚠️ Could not decrypt connection string for ${t.slug}. Skipping.`);
        continue;
      }

      const conn = await getTenantConnection(t._id.toString(), connStr);
      const Role = conn.model("Role");
      const User = conn.model("User");

      const customerRole = await Role.findOne({ name: "customer" });
      const userRole = await Role.findOne({ name: "user" });

      if (customerRole && userRole) {
        console.log(`- Both "customer" and "user" roles found.`);
        const res = await User.updateMany({ role: customerRole._id }, { $set: { role: userRole._id } });
        console.log(`- Reassigned ${res.modifiedCount} users from "customer" to "user" role.`);
        await Role.deleteOne({ _id: customerRole._id });
        console.log(`- Deleted legacy "customer" role document.`);
      } else if (customerRole && !userRole) {
        console.log(`- Found legacy "customer" role. Renaming to "user"...`);
        await Role.updateOne(
          { _id: customerRole._id },
          {
            $set: {
              name: "user",
              displayName: "User",
              description: "Default role for storefront registered users. Not a merchant team role.",
              isSystem: true,
              level: 5,
            },
          }
        );
        console.log(`✅ Renamed "customer" role document to "user".`);
      } else if (!customerRole && !userRole) {
        console.log(`- Creating missing "user" role...`);
        await Role.create({
          name: "user",
          displayName: "User",
          description: "Default role for storefront registered users. Not a merchant team role.",
          isSystem: true,
          level: 5,
          permissions: [
            { resource: "products", actions: ["read"] },
            { resource: "categories", actions: ["read"] },
          ],
        });
        console.log(`✅ Created "user" role.`);
      } else {
        console.log(`✅ Tenant already has "user" role and no legacy "customer" role.`);
      }
    }

    console.log("\n🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

runMigration();

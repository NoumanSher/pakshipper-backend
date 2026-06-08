import mongoose from "mongoose";
import dotenv from "dotenv";
import { decrypt } from "./utils/encryption.js";

dotenv.config();

const mongoUrl = process.env.MONGO_URL || "mongodb+srv://noumankhan:kOocpumqmC4ccjBi@pakshipper-backend.kwqdj4p.mongodb.net/pakshipper_platform?retryWrites=true&w=majority";

async function checkTenantDb() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("Connected to platform DB!");

    const tenantSchema = new mongoose.Schema({
      name: String,
      slug: String,
      status: String,
      database: {
        connectionString: String
      }
    }, { strict: false });

    const Tenant = mongoose.model("Tenant", tenantSchema, "tenants");

    const shoesTenant = await Tenant.findOne({ slug: "shoes" }).lean();
    if (!shoesTenant) {
      console.log("shoes tenant not found!");
      process.exit(0);
    }

    console.log("Found shoes tenant:", shoesTenant.name);
    console.log("Encrypted DB String:", shoesTenant.database?.connectionString);

    const decryptedString = decrypt(shoesTenant.database?.connectionString);
    console.log("Decrypted DB String:", decryptedString);

    if (decryptedString) {
      try {
        console.log("Testing connection to shoes tenant DB...");
        const shoesConn = await mongoose.createConnection(decryptedString).asPromise();
        console.log("Connection to shoes tenant DB SUCCESSFUL!");
        await shoesConn.close();
      } catch (connError) {
        console.error("Connection to shoes tenant DB FAILED:", connError);
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkTenantDb();

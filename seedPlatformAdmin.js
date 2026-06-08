import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { connectToPlatformDB } from "./config/platformConnection.js";

dotenv.config();

const seedPlatformAdmin = async () => {
  console.log("🚀 Seeding Platform Admin...");
  try {
    const platformDb = await connectToPlatformDB();
    const PlatformAdmin = platformDb.model("PlatformAdmin");

    const email = process.env.PLATFORM_ADMIN_EMAIL || "admin@pakshipper.com";
    const username = process.env.PLATFORM_ADMIN_USERNAME || "SuperAdmin";
    const password = process.env.PLATFORM_ADMIN_PASSWORD || "adminpassword123";

    const existingAdmin = await PlatformAdmin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      console.log(`ℹ️ Platform Admin with email "${email}" already exists.`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new PlatformAdmin({
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      role: "super_admin",
      isActive: true,
    });

    await newAdmin.save();
    console.log(`✅ Platform Admin successfully created!`);
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Username: ${username}`);
    console.log(`🔑 Password: ${password}`);
    
    // Close connections
    await platformDb.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed Platform Admin:", error);
    process.exit(1);
  }
};

seedPlatformAdmin();

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let platformConnection = null;

/**
 * Connects to the Platform (Master) Database.
 * This database holds Tenants and PlatformAdmins.
 */
export const connectToPlatformDB = async () => {
  if (platformConnection) return platformConnection;

  const mongoUrl = process.env.PLATFORM_MONGO_URL || process.env.MONGO_URL; // Fallback to MONGO_URL if PLATFORM_MONGO_URL is not set

  if (!mongoUrl) {
    throw new Error("PLATFORM_MONGO_URL (or MONGO_URL) environment variable is not defined.");
  }

  try {
    // We create a separate connection for the platform DB to avoid mixing with tenant DBs
    platformConnection = await mongoose.createConnection(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();
    
    console.log("🟢 Connected to Platform Database.");
    
    // Load platform models onto this connection
    // We don't need the dynamic registry here because platform models are static
    await import("../models/platform/Tenant.js").then(m => platformConnection.model("Tenant", m.default.schema));
    await import("../models/platform/PlatformAdmin.js").then(m => platformConnection.model("PlatformAdmin", m.default.schema));

    return platformConnection;
  } catch (error) {
    console.error("❌ Failed to connect to Platform Database:", error);
    throw error;
  }
};

export const getPlatformConnection = () => {
  if (!platformConnection) {
    throw new Error("Platform DB is not connected. Call connectToPlatformDB() first.");
  }
  return platformConnection;
};

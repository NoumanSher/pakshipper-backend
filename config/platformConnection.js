import mongoose from "mongoose";

/**
 * Platform (Master) Database Connection Manager
 *
 * Uses a promise-singleton to guarantee exactly ONE connection per Node.js
 * process, even when multiple callers invoke connectToPlatformDB() concurrently.
 *
 * DNS is configured centrally in server.js — do NOT duplicate dns.setServers() here.
 * dotenv.config() is called in server.js before this module is imported.
 */

let connectionPromise = null;
let platformConnection = null;

/**
 * Connects to the Platform (Master) Database.
 * This database holds Tenants and PlatformAdmins.
 *
 * Concurrent calls will share the same connection promise — only ONE
 * MongoDB connection is ever created per process.
 *
 * @returns {Promise<mongoose.Connection>}
 */
export const connectToPlatformDB = async () => {
  // Fast path: connection already established
  if (platformConnection && platformConnection.readyState === 1) {
    return platformConnection;
  }

  // If a connection attempt is already in flight, reuse that promise
  if (connectionPromise) return connectionPromise;

  // Create the connection promise — all concurrent callers will await this
  connectionPromise = _createPlatformConnection();

  try {
    platformConnection = await connectionPromise;
    return platformConnection;
  } catch (error) {
    // On failure, clear the promise so the next call can retry
    connectionPromise = null;
    platformConnection = null;
    throw error;
  }
};

/**
 * Internal: creates the actual MongoDB connection and registers platform models.
 * @returns {Promise<mongoose.Connection>}
 */
const _createPlatformConnection = async () => {
  const mongoUrl = process.env.PLATFORM_MONGO_URL || process.env.MONGO_URL;

  if (!mongoUrl) {
    throw new Error(
      "PLATFORM_MONGO_URL (or MONGO_URL) environment variable is not defined."
    );
  }

  try {
    const connection = await mongoose
      .createConnection(mongoUrl, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 5,
        maxIdleTimeMS: 60000, // Close idle driver sockets after 60s of inactivity
      })
      .asPromise();

    console.log("🟢 Connected to Platform Database.");

    // Register platform models idempotently
    const TenantModule = await import("../models/platform/Tenant.js");
    if (!connection.models.Tenant) {
      connection.model("Tenant", TenantModule.default.schema);
    }

    const PlatformAdminModule = await import(
      "../models/platform/PlatformAdmin.js"
    );
    if (!connection.models.PlatformAdmin) {
      connection.model("PlatformAdmin", PlatformAdminModule.default.schema);
    }

    return connection;
  } catch (error) {
    console.error("❌ Failed to connect to Platform Database:", error.message);
    throw error;
  }
};

/**
 * Returns the existing Platform DB connection.
 * Throws if connectToPlatformDB() has not been called yet.
 *
 * @returns {mongoose.Connection}
 */
export const getPlatformConnection = () => {
  if (!platformConnection) {
    throw new Error(
      "Platform DB is not connected. Call connectToPlatformDB() first."
    );
  }
  return platformConnection;
};

/**
 * Closes the Platform DB connection (for graceful shutdown).
 * Safely handles shutdown even if a connection attempt is currently in flight.
 */
export const closePlatformConnection = async () => {
  if (connectionPromise) {
    try {
      const conn = await connectionPromise;
      await conn.close();
    } catch {
      // Ignore error if connection attempt failed during shutdown
    } finally {
      connectionPromise = null;
      platformConnection = null;
    }
  } else if (platformConnection) {
    try {
      await platformConnection.close();
    } finally {
      platformConnection = null;
    }
  }
  console.log("🛑 Platform connection closed.");
};

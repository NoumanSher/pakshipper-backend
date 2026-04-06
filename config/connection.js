import mongoose from "mongoose";
import dns from "dns";

// Override default DNS servers to use Google's DNS, to bypass local network DNS timeouts
dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

/**
 * @function ConnectDataBase
 * @description Establishes a connection to the MongoDB database using the MONGO_URL from environment variables.
 *
 * @returns {Promise<void>}
 *
 * @example
 * import ConnectDataBase from './config/db.js';
 * ConnectDataBase();
 */

const ConnectDataBase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log("Connected to \n" + process.env.MONGO_URL.blue.underline);
  } catch (error) {
    console.error("❌ MongoDB connection error:".red.bold, error);
    throw error; // Rethrow to let the caller handle it
  }
};

export default ConnectDataBase;

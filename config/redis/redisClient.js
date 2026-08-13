import { createClient } from "redis";
import dotenv from "dotenv";
import colors from "colors";
colors.enable();

dotenv.config();

let lastErrorLoggedTime = 0;

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) || 6379,
    connectTimeout: 4000,
    reconnectStrategy: (retries) => {
      // If failed 3 times in a row, backoff to 60s intervals so we don't block sockets or flood logs
      if (retries > 3) {
        return 60000;
      }
      return Math.min(retries * 1000, 3000);
    },
  },
  password: process.env.REDIS_PASSWORD,
});

client.on("error", (err) => {
  // Throttle error logs to once every 60 seconds
  const now = Date.now();
  if (now - lastErrorLoggedTime > 60000) {
    console.warn("⚠️ Redis Client Warning (running in fallback mode without cache):", err.message || err);
    lastErrorLoggedTime = now;
  }
});

client.on("connect", () => {
  console.log("✅ Redis connected".red.underline);
});

// Non-blocking asynchronous connection initialization
client.connect().catch((err) => {
  // Handled silently - server will operate in fallback mode
});

export default client;

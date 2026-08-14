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
  const msg = err?.message || String(err);
  // Ignore routine socket reconnect blips from cloud Redis idle timeouts
  if (msg.includes("Socket closed unexpectedly") || msg.includes("ECONNRESET")) {
    return;
  }
  // Throttle error logs to once every 60 seconds
  const now = Date.now();
  if (now - lastErrorLoggedTime > 60000) {
    console.warn("⚠️ Redis Client Warning (running in fallback mode without cache):", msg);
    lastErrorLoggedTime = now;
  }
});

client.on("connect", () => {
  console.log("✅ Redis connected".green);
});

// Non-blocking asynchronous connection initialization
client.connect().catch((err) => {
  // Handled silently - server will operate in fallback mode
});

export default client;

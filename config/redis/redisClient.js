import { createClient } from "redis";
import dotenv from "dotenv";
import colors from "colors"; // to use .cyan
colors.enable();

dotenv.config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
  password: process.env.REDIS_PASSWORD,
});

client.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

client.on("connect", () => {
  console.log("✅ Redis connected".red.underline);
});
await client.connect();

export default client;

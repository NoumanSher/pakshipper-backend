// import client from "./config/redis/redisClient.js";

// async function testRedis() {
//   await client.set("greeting", "Hello from Redis with import!");
//   const value = await client.get("greeting");
//   console.log("🧠 Retrieved:", value);
// }

// testRedis();
import cron from "node-cron";
// Schedule a job to run every 30 seconds
console.log("Running")
cron.schedule("*/30 * * * * *", () => {
  console.log("⏰ Cron job executed at", new Date().toLocaleTimeString());
});

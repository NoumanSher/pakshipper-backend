import client from "./config/redis/redisClient.js";

async function flushCache() {
    try {
        if (!client.isOpen) {
            await client.connect();
        }
        await client.flushAll();
        console.log("✅ Redis cache flushed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to flush Redis:", error);
        process.exit(1);
    }
}

flushCache();

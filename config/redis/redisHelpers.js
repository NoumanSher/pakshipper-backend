import client from "./redisClient.js";

/**
 * Get a tenant-scoped Redis key
 * @param {string} tenantId - The ID of the tenant
 * @param {string} key - The base cache key
 * @returns {string} The tenant-scoped key (e.g., "t:abc123:products::page1")
 */
export const getTenantRedisKey = (tenantId, key) => `t:${tenantId}:${key}`;

/**
 * Flush only the cache keys belonging to a specific tenant using SCAN + DEL pattern.
 * This replaces client.flushAll() which would wipe all tenants' cache.
 * 
 * @param {string} tenantId - The ID of the tenant whose cache needs flushing
 */
export const flushTenantCache = async (tenantId) => {
  if (!client.isReady) {
    console.warn("⚠️ Redis client not ready, cannot flush tenant cache.");
    return;
  }

  const pattern = `t:${tenantId}:*`;
  let cursor = 0;

  try {
    do {
      // Use SCAN to find keys incrementally without blocking Redis
      const reply = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = reply.cursor;
      const keys = reply.keys;
      
      if (keys.length > 0) {
        // Delete the found keys
        await client.del(keys);
      }
    } while (cursor !== 0);
    
    console.log(`🧹 Flushed cache for tenant: ${tenantId}`);
  } catch (error) {
    console.error(`❌ Error flushing cache for tenant ${tenantId}:`, error);
  }
};

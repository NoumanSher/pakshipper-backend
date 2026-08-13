import client from "./redisClient.js";

/**
 * Get a tenant-scoped Redis key
 * @param {string} tenantId - The ID of the tenant
 * @param {string} key - The base cache key
 * @returns {string} The tenant-scoped key (e.g., "t:abc123:products::page1")
 */
export const getTenantRedisKey = (tenantId, key) => `t:${tenantId}:${key}`;

/**
 * Safe get wrapper - returns null gracefully if Redis is down/offline
 */
export const safeGet = async (key) => {
  if (!client.isReady) return null;
  try {
    return await client.get(key);
  } catch (error) {
    return null;
  }
};

/**
 * Safe setEx wrapper - fails silently if Redis is down/offline
 */
export const safeSetEx = async (key, ttl, value) => {
  if (!client.isReady) return;
  try {
    await client.setEx(key, ttl, value);
  } catch (error) {
    // Ignore cache set errors
  }
};

/**
 * Safe del wrapper - fails silently if Redis is down/offline
 */
export const safeDel = async (key) => {
  if (!client.isReady) return;
  try {
    await client.del(key);
  } catch (error) {
    // Ignore cache delete errors
  }
};

/**
 * Flush only the cache keys belonging to a specific tenant using SCAN + DEL pattern.
 * This replaces client.flushAll() which would wipe all tenants' cache.
 * 
 * @param {string} tenantId - The ID of the tenant whose cache needs flushing
 */
export const flushTenantCache = async (tenantId) => {
  if (!client.isReady) {
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
    console.warn(`⚠️ Error flushing cache for tenant ${tenantId}:`, error.message || error);
  }
};

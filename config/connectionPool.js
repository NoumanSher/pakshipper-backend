import mongoose from "mongoose";
import { compileTenantModels } from "../models/registry.js";

const MAX_POOL_SIZE = 100;
const connectionPool = new Map();

/**
 * Retrieves an existing connection or creates a new one for the given tenant.
 * Follows an LRU (Least Recently Used) eviction policy if max pool size is reached.
 * 
 * @param {string} tenantId 
 * @param {string} connectionString 
 * @returns {Promise<mongoose.Connection>}
 */
export const getTenantConnection = async (tenantId, connectionString) => {
  if (connectionPool.has(tenantId)) {
    const connInfo = connectionPool.get(tenantId);
    // Refresh last accessed time
    connInfo.lastAccessed = Date.now();
    
    // If the connection was disconnected, try to reconnect
    if (connInfo.connection.readyState === 0) {
      console.log(`⚠️ Tenant ${tenantId} connection is dead. Reconnecting...`);
      await connInfo.connection.openUri(connectionString);
    }
    
    return connInfo.connection;
  }

  // If pool is full, evict the least recently used connection
  if (connectionPool.size >= MAX_POOL_SIZE) {
    evictLRUConnection();
  }

  console.log(`🔄 Creating new connection for tenant: ${tenantId}`);
  try {
    const connection = await mongoose.createConnection(connectionString, {
      serverSelectionTimeoutMS: 5000,
      // Add standard connection pooling options if needed
      maxPoolSize: 10, 
    }).asPromise();

    // Compile models onto this specific connection
    compileTenantModels(connection);

    connectionPool.set(tenantId, {
      connection,
      lastAccessed: Date.now()
    });

    return connection;
  } catch (error) {
    console.error(`❌ Error connecting to tenant DB (${tenantId}):`, error);
    throw new Error("Failed to connect to tenant database.");
  }
};

const evictLRUConnection = () => {
  let lruTenantId = null;
  let oldestAccess = Infinity;

  for (const [tenantId, connInfo] of connectionPool.entries()) {
    if (connInfo.lastAccessed < oldestAccess) {
      oldestAccess = connInfo.lastAccessed;
      lruTenantId = tenantId;
    }
  }

  if (lruTenantId) {
    console.log(`🧹 Evicting idle connection for tenant: ${lruTenantId}`);
    const connInfo = connectionPool.get(lruTenantId);
    connInfo.connection.close()
      .catch(err => console.error(`Error closing evicted connection ${lruTenantId}:`, err));
    connectionPool.delete(lruTenantId);
  }
};

/**
 * Forcibly close and remove a tenant's connection from the pool
 * (e.g., if the tenant is deleted or suspended)
 */
export const removeTenantConnection = async (tenantId) => {
  if (connectionPool.has(tenantId)) {
    const connInfo = connectionPool.get(tenantId);
    await connInfo.connection.close();
    connectionPool.delete(tenantId);
    console.log(`🔌 Removed connection for tenant: ${tenantId}`);
  }
};

/**
 * Close all connections in the pool (e.g., during graceful shutdown)
 */
export const closeAllConnections = async () => {
  const promises = [];
  for (const [tenantId, connInfo] of connectionPool.entries()) {
    promises.push(connInfo.connection.close());
  }
  await Promise.all(promises);
  connectionPool.clear();
  console.log("🛑 Closed all tenant connections.");
};

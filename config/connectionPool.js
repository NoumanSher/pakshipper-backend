import mongoose from "mongoose";
import { compileTenantModels } from "../models/registry.js";

/**
 * Tenant Connection Pool Manager
 *
 * Manages a bounded pool of Mongoose connections to tenant databases
 * with LRU (Least Recently Used) eviction and concurrency-safe connection creation.
 *
 * Key design decisions:
 *   - MAX_TENANT_CONNECTIONS = 5 → at most 5 tenant DB connections cached in memory
 *   - maxPoolSize = 3 per tenant → max 3 driver sockets per tenant connection
 *   - maxIdleTimeMS = 60000 → idle driver sockets closed after 60s of inactivity
 *   - pendingConnections Map guarantees ONE connection attempt per tenant for concurrent requests
 */

const MAX_TENANT_CONNECTIONS = 5;
const TENANT_MAX_POOL_SIZE = 3;

/** @type {Map<string, { connection: mongoose.Connection, lastAccessed: number }>} */
const connectionPool = new Map();

/** @type {Map<string, Promise<mongoose.Connection>>} */
const pendingConnections = new Map();

/**
 * Retrieves an existing connection or creates a new one for the given tenant.
 * Concurrency-safe: concurrent calls for the same tenant share a single connection promise.
 *
 * @param {string} tenantId
 * @param {string} connectionString
 * @returns {Promise<mongoose.Connection>}
 */
export const getTenantConnection = async (tenantId, connectionString) => {
  // 1. Fast path: connection exists in pool and is alive
  if (connectionPool.has(tenantId)) {
    const connInfo = connectionPool.get(tenantId);
    connInfo.lastAccessed = Date.now();

    // Check if connection is still alive (readyState: 1=connected, 2=connecting)
    if (connInfo.connection.readyState === 1 || connInfo.connection.readyState === 2) {
      return connInfo.connection;
    }

    // Connection is dead (readyState 0=disconnected or 3=disconnecting)
    console.log(`⚠️ Tenant ${tenantId} connection is dead (readyState=${connInfo.connection.readyState}). Replacing...`);
    connectionPool.delete(tenantId);
    connInfo.connection.close().catch(() => {}); // Best-effort close of dead connection
  }

  // 2. If a connection is already being created for this tenant, await the same promise
  if (pendingConnections.has(tenantId)) {
    return pendingConnections.get(tenantId);
  }

  // 3. Create a new connection promise & track in pendingConnections
  const connectionPromise = _createTenantConnection(tenantId, connectionString);
  pendingConnections.set(tenantId, connectionPromise);

  try {
    return await connectionPromise;
  } catch (error) {
    // Failure handling: error is re-thrown; _createTenantConnection ensures cleanup
    throw error;
  }
};

/**
 * Internal: creates a new tenant connection, compiles models, and adds to pool.
 * Cleanly handles failure cleanup (closing partial connection & removing from pending).
 *
 * @param {string} tenantId
 * @param {string} connectionString
 * @returns {Promise<mongoose.Connection>}
 */
const _createTenantConnection = async (tenantId, connectionString) => {
  let connection = null;

  try {
    // Evict LRU if pool is full before creating new connection
    if (connectionPool.size >= MAX_TENANT_CONNECTIONS) {
      await _evictLRUConnection();
    }

    console.log(`🔄 Creating new connection for tenant: ${tenantId}`);

    connection = await mongoose
      .createConnection(connectionString, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: TENANT_MAX_POOL_SIZE,
        maxIdleTimeMS: 60000, // Close idle driver sockets after 60s
      })
      .asPromise();

    // Compile models onto this specific connection (idempotent)
    compileTenantModels(connection);

    // Self-healing migration: seamlessly rename legacy "customer" role to "user"
    const Role = connection.model("Role");
    Role.updateOne(
      { name: "customer" },
      {
        $set: {
          name: "user",
          displayName: "User",
          description: "Default role for storefront registered users. Not a merchant team role.",
          isSystem: true,
          level: 5,
        },
      }
    ).catch(() => {});

    // Add to pool ONLY after successful connection & model compilation
    connectionPool.set(tenantId, {
      connection,
      lastAccessed: Date.now(),
    });

    return connection;
  } catch (error) {
    // Cleanup on failure: close partially created connection if it exists
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error(`⚠️ Failed to close broken connection for tenant ${tenantId}:`, closeErr.message);
      }
    }
    console.error(`❌ Error connecting to tenant DB (${tenantId}):`, error.message);
    throw new Error("Failed to connect to tenant database.");
  } finally {
    // Guaranteed removal from pendingConnections on both success and failure
    pendingConnections.delete(tenantId);
  }
};

/**
 * Evicts the least recently used tenant connection from the pool.
 * Skips tenants that are currently being connected (in pendingConnections).
 * Awaits connection.close() to ensure the connection is fully released.
 */
const _evictLRUConnection = async () => {
  let lruTenantId = null;
  let oldestAccess = Infinity;

  for (const [tenantId, connInfo] of connectionPool.entries()) {
    // Skip tenants with pending connections — never evict a tenant currently establishing a connection
    if (pendingConnections.has(tenantId)) continue;

    if (connInfo.lastAccessed < oldestAccess) {
      oldestAccess = connInfo.lastAccessed;
      lruTenantId = tenantId;
    }
  }

  if (lruTenantId) {
    console.log(`🧹 Evicting idle connection for tenant: ${lruTenantId}`);
    const connInfo = connectionPool.get(lruTenantId);
    connectionPool.delete(lruTenantId);

    try {
      await connInfo.connection.close();
    } catch (err) {
      console.error(`⚠️ Error closing evicted connection for ${lruTenantId}:`, err.message);
    }
  }
};

/**
 * Forcibly close and remove a tenant's connection from the pool.
 * Used when a tenant is deleted, suspended, or its config changes.
 *
 * @param {string} tenantId
 */
export const removeTenantConnection = async (tenantId) => {
  // Wait for any pending connection to finish before removing
  if (pendingConnections.has(tenantId)) {
    try {
      await pendingConnections.get(tenantId);
    } catch {
      // Connection attempt failed — nothing to remove
    }
  }

  if (connectionPool.has(tenantId)) {
    const connInfo = connectionPool.get(tenantId);
    connectionPool.delete(tenantId);

    try {
      await connInfo.connection.close();
    } catch (err) {
      console.error(`⚠️ Error closing connection for tenant ${tenantId}:`, err.message);
    }

    console.log(`🔌 Removed connection for tenant: ${tenantId}`);
  }
};

/**
 * Close all connections in the pool (for graceful shutdown).
 * Waits for any pending connections to settle and closes both pending and pooled connections.
 */
export const closeAllConnections = async () => {
  // 1. Wait for all pending connection attempts to settle
  if (pendingConnections.size > 0) {
    const pendingPromises = [...pendingConnections.values()];
    const results = await Promise.allSettled(pendingPromises);
    
    // Close any connections that succeeded during the shutdown window
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        try {
          await result.value.close();
        } catch {}
      }
    }
    pendingConnections.clear();
  }

  // 2. Close all pooled connections
  const closePromises = [];
  for (const [tenantId, connInfo] of connectionPool.entries()) {
    closePromises.push(
      connInfo.connection
        .close()
        .catch((err) =>
          console.error(`⚠️ Error closing connection for tenant ${tenantId}:`, err.message)
        )
    );
  }

  await Promise.all(closePromises);
  connectionPool.clear();
  console.log("🛑 Closed all tenant connections.");
};

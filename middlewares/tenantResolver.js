import { getPlatformConnection } from "../config/platformConnection.js";
import { getTenantConnection } from "../config/connectionPool.js";
import { getTenantModels } from "../models/registry.js";
import { decrypt } from "../utils/encryption.js";
import NodeCache from "node-cache";

// Cache tenant lookups for 5 minutes to avoid hitting the platform DB on every request
const tenantCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Extracts the domain from the request origin or host header.
 * Cleans it up to ensure it matches the database format.
 */
const getRequestDomain = (req) => {
  let domain = req.headers.origin || req.headers.host;
  if (!domain) return null;

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');
  // Remove port
  domain = domain.split(':')[0];
  // Remove trailing slash
  domain = domain.replace(/\/$/, '');

  return domain;
};

/**
 * Decrypts sensitive fields in the tenant configuration.
 */
const getDecryptedConfig = (config) => {
  const decrypted = JSON.parse(JSON.stringify(config)); // Deep copy

  if (decrypted.stripe) {
    if (decrypted.stripe.secretKey) decrypted.stripe.secretKey = decrypt(decrypted.stripe.secretKey);
    if (decrypted.stripe.webhookSecret) decrypted.stripe.webhookSecret = decrypt(decrypted.stripe.webhookSecret);
  }
  
  if (decrypted.email && decrypted.email.pass) {
    decrypted.email.pass = decrypt(decrypted.email.pass);
  }

  if (decrypted.oauth) {
    if (decrypted.oauth.google && decrypted.oauth.google.clientSecret) {
      decrypted.oauth.google.clientSecret = decrypt(decrypted.oauth.google.clientSecret);
    }
    if (decrypted.oauth.linkedin && decrypted.oauth.linkedin.secretKey) {
      decrypted.oauth.linkedin.secretKey = decrypt(decrypted.oauth.linkedin.secretKey);
    }
  }

  // Note: cloudinary api secrets are also encrypted in DB but used by factories
  if (decrypted.cloudinary) {
    if (decrypted.cloudinary.merchantAccount && decrypted.cloudinary.merchantAccount.apiSecret) {
      decrypted.cloudinary.merchantAccount.apiSecret = decrypt(decrypted.cloudinary.merchantAccount.apiSecret);
    }
    if (decrypted.cloudinary.customerAccount && decrypted.cloudinary.customerAccount.apiSecret) {
      decrypted.cloudinary.customerAccount.apiSecret = decrypt(decrypted.cloudinary.customerAccount.apiSecret);
    }
  }

  return decrypted;
};

export const tenantResolver = async (req, res, next) => {
  // Allow platform routes to bypass tenant resolution
  if (req.path.startsWith('/api/platform')) {
    return next();
  }

  try {
    const tenantSlug = req.headers['x-tenant-slug'];
    let tenant = null;

    if (tenantSlug) {
      // 1. Try to get tenant from cache using slug
      tenant = tenantCache.get(`slug:${tenantSlug}`);

      // 2. If not in cache, lookup in Platform DB by slug
      if (!tenant) {
        const platformConn = getPlatformConnection();
        const TenantModel = platformConn.model("Tenant");
        tenant = await TenantModel.findOne({ slug: tenantSlug }).lean();
        if (tenant) {
          tenantCache.set(`slug:${tenantSlug}`, tenant);
        }
      }
    } else {
      const domain = getRequestDomain(req);
      
      if (!domain) {
        return res.status(400).json({ error: "No domain provided in Origin or Host header" });
      }

      // 1. Try to get tenant from cache
      tenant = tenantCache.get(domain);

      // 2. If not in cache, lookup in Platform DB
      if (!tenant) {
        const platformConn = getPlatformConnection();
        const TenantModel = platformConn.model("Tenant");
        
        // Strip "admin." prefix if present to also match the base domain
        const baseDomain = domain.startsWith('admin.') ? domain.substring(6) : domain;
        
        // Find tenant where either the full domain or the base domain exists in the domains array
        tenant = await TenantModel.findOne({ 
          'domains.domain': { $in: [domain, baseDomain] } 
        }).lean();
        
        if (tenant) {
          // Cache the full document
          tenantCache.set(domain, tenant);
        }
      }
    }

    if (!tenant) {
      return res.status(404).json({ error: tenantSlug ? `Store not found for slug "${tenantSlug}".` : "Store not found for this domain." });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: "This store is currently suspended." });
    }
    
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: `Store is currently ${tenant.status}` });
    }

    // 3. Connect to the tenant's database
    const dbConnectionString = decrypt(tenant.database.connectionString);
    if (!dbConnectionString) {
      return res.status(500).json({ error: "Internal error: Invalid database configuration" });
    }

    const tenantDb = await getTenantConnection(tenant._id.toString(), dbConnectionString);
    
    // 4. Get compiled models for this tenant
    const models = getTenantModels(tenantDb);

    // 5. Decrypt external service configurations
    const tenantConfig = getDecryptedConfig(tenant.config || {});
    tenantConfig.tenantId = tenant._id.toString();
    tenantConfig.slug = tenant.slug;
    tenantConfig.name = tenant.name;

    // 6. Attach context to request
    req.tenant = tenant;
    req.tenantDb = tenantDb;
    req.models = models;
    req.tenantConfig = tenantConfig;

    next();
  } catch (error) {
    console.error("Tenant Resolution Error:", error);
    res.status(500).json({ error: "Failed to resolve store configuration" });
  }
};

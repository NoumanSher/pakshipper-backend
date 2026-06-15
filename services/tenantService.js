import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { getPlatformConnection } from "../config/platformConnection.js";
import { getTenantConnection, removeTenantConnection } from "../config/connectionPool.js";
import { encrypt } from "../utils/encryption.js";
import AppError from "../utils/AppError.js";

class TenantService {
  /**
   * Provision a new tenant (store).
   * Creates the Platform DB tenant record, seeds tenant database with roles,
   * creates the store owner account, and creates default store settings.
   *
   * @param {Object} tenantData - Tenant configuration data (name, slug, domains, database details)
   * @param {Object} ownerData - Merchant owner user details (name, email, password)
   * @param {string} createdByAdminId - Platform Admin ID who triggered provisioning
   * @returns {Promise<Object>} The provisioned tenant document
   */
  static async provisionTenant(tenantData, ownerData, createdByAdminId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    // 1. Validate uniqueness in platform DB
    const existingTenantSlug = await Tenant.findOne({ slug: tenantData.slug });
    if (existingTenantSlug) {
      throw new AppError(`Tenant with slug "${tenantData.slug}" already exists`, 400);
    }

    // Check if any domain is already registered
    const domainNames = tenantData.domains.map(d => d.domain);
    const existingTenantDomain = await Tenant.findOne({ "domains.domain": { $in: domainNames } });
    if (existingTenantDomain) {
      throw new AppError("One or more of the specified domains are already registered", 400);
    }

    // 2. Encrypt sensitive fields (connection string, stripe keys, email pass)
    const encryptedConnectionString = encrypt(tenantData.database.connectionString);
    if (!encryptedConnectionString) {
      throw new AppError("Failed to encrypt database connection string", 500);
    }

    const tenantRecordData = {
      name: tenantData.name,
      slug: tenantData.slug,
      domains: tenantData.domains,
      database: {
        connectionString: encryptedConnectionString,
        name: tenantData.database.name,
      },
      owner: {
        email: ownerData.email.toLowerCase(),
        name: ownerData.name,
      },
      config: {
        stripe: {
          secretKey: tenantData.config?.stripe?.secretKey ? encrypt(tenantData.config.stripe.secretKey) : "",
          webhookSecret: tenantData.config?.stripe?.webhookSecret ? encrypt(tenantData.config.stripe.webhookSecret) : "",
          publishableKey: tenantData.config?.stripe?.publishableKey || "",
        },
        cloudinary: {
          customerAccount: tenantData.config?.cloudinary?.customerAccount ? {
            cloudName: tenantData.config.cloudinary.customerAccount.cloudName,
            apiKey: tenantData.config.cloudinary.customerAccount.apiKey,
            apiSecret: encrypt(tenantData.config.cloudinary.customerAccount.apiSecret),
          } : null,
          merchantAccount: tenantData.config?.cloudinary?.merchantAccount ? {
            cloudName: tenantData.config.cloudinary.merchantAccount.cloudName,
            apiKey: tenantData.config.cloudinary.merchantAccount.apiKey,
            apiSecret: encrypt(tenantData.config.cloudinary.merchantAccount.apiSecret),
          } : null,
        },
        email: {
          service: tenantData.config?.email?.service || "gmail",
          user: tenantData.config?.email?.user || "",
          pass: tenantData.config?.email?.pass ? encrypt(tenantData.config.email.pass) : "",
          senderName: tenantData.config?.email?.senderName || tenantData.name,
        },
        oauth: {
          google: {
            clientId: tenantData.config?.oauth?.google?.clientId || "",
            clientSecret: tenantData.config?.oauth?.google?.clientSecret ? encrypt(tenantData.config.oauth.google.clientSecret) : "",
            callbackUrl: tenantData.config?.oauth?.google?.callbackUrl || "",
          },
          linkedin: {
            apiKey: tenantData.config?.oauth?.linkedin?.apiKey || "",
            secretKey: tenantData.config?.oauth?.linkedin?.secretKey ? encrypt(tenantData.config.oauth.linkedin.secretKey) : "",
            callbackUrl: tenantData.config?.oauth?.linkedin?.callbackUrl || "",
          },
        },
        cors: {
          allowedOrigins: tenantData.config?.cors?.allowedOrigins || domainNames.map(d => `https://${d}`),
        },
        frontendUrl: tenantData.config?.frontendUrl || `https://${domainNames[0] || 'localhost'}`,
        merchantPanelUrl: tenantData.config?.merchantPanelUrl || `https://admin.${domainNames[0] || 'localhost'}`,
      },
      subscription: tenantData.subscription || {
        plan: "trial",
        status: "active",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
      status: "provisioning",
      createdBy: createdByAdminId,
    };

    const newTenant = new Tenant(tenantRecordData);
    await newTenant.save();

    let tenantConnection;
    try {
      // 3. Establish connection to the new tenant DB
      tenantConnection = await getTenantConnection(newTenant._id.toString(), tenantData.database.connectionString);

      // 4. Seed system roles
      const rolesMap = await this.seedDefaultRoles(tenantConnection);

      // 5. Create merchant owner user account
      await this.createMerchantOwner(tenantConnection, ownerData, rolesMap.owner);

      // 6. Seed default settings
      await this.seedDefaultSettings(tenantConnection, tenantData.name, ownerData.email);

      // 7. Update status to active
      newTenant.status = "active";
      await newTenant.save();

      return newTenant;
    } catch (error) {
      console.error("❌ Error provisioning tenant database:", error);
      // Clean up connection pool if active
      await removeTenantConnection(newTenant._id.toString()).catch(() => {});
      // Rollback platform DB record or set status to failed/deleted
      newTenant.status = "deleted";
      newTenant.provisioningError = error.message;
      await newTenant.save().catch(() => {});
      throw new AppError(`Tenant provisioning failed: ${error.message}`, 500);
    }
  }

  /**
   * Seed default system roles into the tenant database.
   */
  static async seedDefaultRoles(connection) {
    const Role = connection.model("Role");

    const defaultRoles = [
      {
        name: "owner",
        displayName: "Owner",
        description: "Full control of the store, including billing and user roles.",
        level: 100,
        isSystem: true,
        permissions: [
          { resource: "products", actions: ["read", "write", "delete", "approve"] },
          { resource: "orders", actions: ["read", "write", "delete"] },
          { resource: "categories", actions: ["read", "write", "delete"] },
          { resource: "customers", actions: ["read", "write", "delete"] },
          { resource: "settings", actions: ["read", "write"] },
          { resource: "roles", actions: ["read", "write"] },
          { resource: "reviews", actions: ["read", "write", "delete"] },
          { resource: "notifications", actions: ["read", "write"] },
          { resource: "store_config", actions: ["read", "write"] },
          { resource: "analytics", actions: ["read"] }
        ]
      },
      {
        name: "store_admin",
        displayName: "Admin",
        description: "Administrative access to store operations and team users.",
        level: 90,
        isSystem: true,
        permissions: [
          { resource: "products", actions: ["read", "write", "delete", "approve"] },
          { resource: "orders", actions: ["read", "write", "delete"] },
          { resource: "categories", actions: ["read", "write", "delete"] },
          { resource: "customers", actions: ["read", "write", "delete"] },
          { resource: "settings", actions: ["read", "write"] },
          { resource: "roles", actions: ["read", "write"] },
          { resource: "reviews", actions: ["read", "write", "delete"] },
          { resource: "notifications", actions: ["read", "write"] },
          { resource: "store_config", actions: ["read"] },
          { resource: "analytics", actions: ["read"] }
        ]
      },
      {
        name: "manager",
        displayName: "Manager",
        description: "Manages catalog, orders, and customer queries.",
        level: 70,
        isSystem: false,
        permissions: [
          { resource: "products", actions: ["read", "write", "approve"] },
          { resource: "orders", actions: ["read", "write"] },
          { resource: "categories", actions: ["read", "write"] },
          { resource: "customers", actions: ["read", "write"] },
          { resource: "reviews", actions: ["read", "write"] },
          { resource: "notifications", actions: ["read"] },
          { resource: "analytics", actions: ["read"] }
        ]
      },
      {
        name: "editor",
        displayName: "Editor",
        description: "Manages products and categories catalog.",
        level: 50,
        isSystem: false,
        permissions: [
          { resource: "products", actions: ["read", "write"] },
          { resource: "categories", actions: ["read", "write"] }
        ]
      },
      {
        name: "support",
        displayName: "Support Agent",
        description: "Manages orders processing and customer communications.",
        level: 30,
        isSystem: false,
        permissions: [
          { resource: "products", actions: ["read"] },
          { resource: "orders", actions: ["read", "write"] },
          { resource: "customers", actions: ["read"] },
          { resource: "reviews", actions: ["read"] }
        ]
      },
      {
        name: "customer",
        displayName: "Customer",
        description: "End consumer storefront customer.",
        level: 10,
        isSystem: true,
        permissions: [
          { resource: "products", actions: ["read"] },
          { resource: "categories", actions: ["read"] }
        ]
      }
    ];

    const rolesMap = {};

    for (const roleData of defaultRoles) {
      // Use findOneAndUpdate to seed safely without duplicates
      const roleObj = await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      rolesMap[roleData.name] = roleObj._id;
    }

    return rolesMap;
  }

  /**
   * Create merchant owner user account in tenant database.
   */
  static async createMerchantOwner(connection, ownerData, roleId) {
    const User = connection.model("User");

    const existingUser = await User.findOne({ email: ownerData.email.toLowerCase() });
    if (existingUser) {
      throw new Error("Owner user email already exists in tenant database");
    }

    const hashedPassword = await bcrypt.hash(ownerData.password, 10);

    const ownerUser = new User({
      email: ownerData.email.toLowerCase(),
      username: ownerData.name,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: roleId,
    });

    await ownerUser.save();
    return ownerUser;
  }

  /**
   * Seed default settings document in tenant database.
   */
  static async seedDefaultSettings(connection, storeName, ownerEmail) {
    const Settings = connection.model("Settings");

    const defaultSettings = {
      title: storeName,
      description: `Welcome to ${storeName}. Your premier destination for quality products.`,
      address: "123 Business Boulevard, Karachi, Pakistan",
      mobile: "+923001234567",
      logo: "https://placehold.co/200x200?text=Logo",
      bannerImg: "https://placehold.co/1200x400?text=Hero+Banner",
      bannerImgLink: "",
      bannerImages: [
        {
          img: "https://placehold.co/1200x400?text=Slide+1",
          altText: "New Season Arrivals",
          link: "/products",
          orderNumber: 1
        }
      ],
      promoCards: [
        {
          img: "https://placehold.co/400x300?text=Promo+1",
          title: "Trending Items",
          subtitle: "Explore popular styles",
          link: "/products",
          orderNumber: 1
        }
      ],
      footerLinks: [
        {
          title: "Shop",
          items: [
            { name: "All Products", url: "/products" },
            { name: "New Arrivals", url: "/products?sort=newest" }
          ]
        },
        {
          title: "Company",
          items: [
            { name: "About Us", url: "/about" },
            { name: "Contact", url: "/contact" }
          ]
        }
      ],
      twitterUrl: "https://twitter.com",
      facebookUrl: "https://facebook.com",
      instagramUrl: "https://instagram.com",
      pinterestUrl: "https://pinterest.com",
      youtubeUrl: "https://youtube.com",
      privacyPolicy: "We protect your privacy. Default policy text here.",
      termsOfService: "Terms and conditions of our store.",
      email: ownerEmail.toLowerCase(),
    };

    // Upsert settings to avoid duplicates
    await Settings.findOneAndUpdate(
      {},
      defaultSettings,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  /**
   * Suspend a tenant store.
   */
  static async suspendTenant(tenantId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    tenant.status = "suspended";
    await tenant.save();

    // Kill connection pool cache for this tenant
    await removeTenantConnection(tenantId).catch(() => {});

    return tenant;
  }

  /**
   * Reactivate a suspended tenant.
   */
  static async activateTenant(tenantId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    tenant.status = "active";
    await tenant.save();

    return tenant;
  }

  /**
   * Soft-delete a tenant.
   */
  static async deleteTenant(tenantId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    tenant.status = "deleted";
    await tenant.save();

    // Kill connection pool cache for this tenant
    await removeTenantConnection(tenantId).catch(() => {});

    return tenant;
  }

  /**
   * Get tenant statistics aggregated from their database.
   */
  static async getTenantStats(tenantId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    if (tenant.status !== "active") {
      throw new AppError("Cannot retrieve stats for non-active tenant", 400);
    }

    const { decrypt } = await import("../utils/encryption.js");
    const connectionString = decrypt(tenant.database.connectionString);
    const connection = await getTenantConnection(tenantId, connectionString);

    const User = connection.model("User");
    const Product = connection.model("Product");
    const PostOrder = connection.model("PostOrder");

    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments({}),
      Product.countDocuments({}),
      PostOrder.countDocuments({})
    ]);

    // Aggregate monthly revenue if orders exist
    const revenueStats = await PostOrder.aggregate([
      { $match: { orderStatus: "delivered" } },
      { $group: { _id: null, totalRevenue: { $sum: "$grandTotal" } } }
    ]);
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      plan: tenant.subscription?.plan || "trial",
      expiresAt: tenant.subscription?.expiresAt || null,
    };
  }
  /**
   * Permanently delete a tenant - drops their database and removes the Platform DB record.
   * Only works on soft-deleted tenants for safety.
   */
  static async permanentDeleteTenant(tenantId) {
    const platformDb = getPlatformConnection();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new AppError("Tenant not found", 404);

    if (tenant.status !== 'deleted') {
      throw new AppError("Only soft-deleted stores can be permanently deleted. Please soft-delete the store first.", 400);
    }

    try {
      // 1. Decrypt connection string and connect to tenant DB
      const { decrypt } = await import("../utils/encryption.js");
      const connectionString = decrypt(tenant.database.connectionString);
      
      if (connectionString) {
        const tenantConnection = await getTenantConnection(tenantId, connectionString);
        
        // 2. Drop the entire tenant database
        await tenantConnection.dropDatabase();
        console.log(`🗑️ Dropped database for tenant: ${tenant.slug}`);
      }
    } catch (dbError) {
      console.error(`⚠️ Failed to drop tenant database (continuing with record removal):`, dbError.message);
    }

    // 3. Remove from connection pool
    await removeTenantConnection(tenantId).catch(() => {});

    // 4. Permanently remove the Platform DB record
    await Tenant.findByIdAndDelete(tenantId);
    console.log(`🗑️ Permanently deleted tenant record: ${tenant.slug}`);

    return { slug: tenant.slug, name: tenant.name };
  }
}

export default TenantService;

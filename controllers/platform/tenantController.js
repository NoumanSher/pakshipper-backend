import TenantService from "../../services/tenantService.js";
import { getPlatformConnection } from "../../config/platformConnection.js";
import { getTenantConnection } from "../../config/connectionPool.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import { decrypt, encrypt } from "../../utils/encryption.js";
import { z } from "zod";
import bcrypt from "bcrypt";

const provisionTenantSchema = z.object({
  tenant: z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    domains: z.array(z.object({
      domain: z.string(),
      type: z.enum(['subdomain', 'custom']),
      isPrimary: z.boolean().default(false),
      sslEnabled: z.boolean().default(true),
    })).optional(),
    database: z.object({
      connectionString: z.string(),
      name: z.string(),
    }).optional(),
    config: z.object({
      stripe: z.object({
        secretKey: z.string().optional(),
        webhookSecret: z.string().optional(),
        publishableKey: z.string().optional(),
      }).optional(),
      cloudinary: z.object({
        customerAccount: z.object({
          cloudName: z.string(),
          apiKey: z.string(),
          apiSecret: z.string(),
        }).optional(),
        merchantAccount: z.object({
          cloudName: z.string(),
          apiKey: z.string(),
          apiSecret: z.string(),
        }).optional(),
      }).optional(),
      email: z.object({
        service: z.string().default('gmail'),
        user: z.string(),
        pass: z.string(),
        senderName: z.string().optional(),
      }).optional(),
      oauth: z.object({
        google: z.object({
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
          callbackUrl: z.string().optional(),
        }).optional(),
        linkedin: z.object({
          apiKey: z.string().optional(),
          secretKey: z.string().optional(),
          callbackUrl: z.string().optional(),
        }).optional(),
      }).optional(),
      frontendUrl: z.string().optional(),
      merchantPanelUrl: z.string().optional(),
    }).optional(),
    subscription: z.object({
      plan: z.enum(['trial', 'basic', 'pro', 'enterprise']).default('trial'),
      status: z.enum(['active', 'suspended', 'cancelled']).default('active'),
      expiresAt: z.string().transform(val => new Date(val)).optional(),
    }).optional(),
  }),
  owner: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

/**
 * @route   POST /platform/tenants
 * @desc    Provision a new tenant store
 * @access  Private/Super Admin
 */
export const createTenant = asyncHandler(async (req, res) => {
  const { tenant, owner } = provisionTenantSchema.parse(req.body);
  const adminId = req.platformAdmin._id;

  // Auto-generate database configuration using Platform DB connection string as base
  if (!tenant.database) {
    const platformMongoUrl = process.env.PLATFORM_MONGO_URL || process.env.MONGO_URL;
    if (!platformMongoUrl) {
      throw new AppError("Platform DB connection URL not configured on backend.", 500);
    }
    
    const dbName = `pakshipper_tenant_${tenant.slug}`;
    let connectionString = platformMongoUrl;
    
    if (platformMongoUrl.includes("pakshipper_platform")) {
      connectionString = platformMongoUrl.replace("pakshipper_platform", dbName);
    } else {
      connectionString = platformMongoUrl.endsWith("/") 
        ? `${platformMongoUrl}${dbName}` 
        : platformMongoUrl.replace(/\/[^\/]+$/, `/${dbName}`);
    }

    tenant.database = { connectionString, name: dbName };
  }

  // Auto-generate domains to use lvh.me (resolves to 127.0.0.1 without hosts configuration)
  if (!tenant.domains || tenant.domains.length === 0) {
    tenant.domains = [
      { domain: `${tenant.slug}.lvh.me`, type: 'subdomain', isPrimary: true },
      { domain: `admin.${tenant.slug}.lvh.me`, type: 'subdomain' }
    ];
  }

  // Cloudinary single-account fallback: if only merchantAccount is provided, use it for customerAccount too
  if (tenant.config?.cloudinary?.merchantAccount && !tenant.config?.cloudinary?.customerAccount) {
    tenant.config.cloudinary.customerAccount = { ...tenant.config.cloudinary.merchantAccount };
  }

  const newTenant = await TenantService.provisionTenant(tenant, owner, adminId);

  res.status(201).json({
    success: true,
    message: "Tenant store provisioned successfully",
    tenant: newTenant,
  });
});

/**
 * @route   GET /platform/tenants
 * @desc    Get all tenants
 * @access  Private/Platform Admin
 */
export const getAllTenants = asyncHandler(async (req, res) => {
  const platformDb = getPlatformConnection();
  const Tenant = platformDb.model("Tenant");

  const tenants = await Tenant.find({})
    .select("-database.connectionString -config.stripe.secretKey -config.stripe.webhookSecret -config.email.pass -config.oauth.google.clientSecret -config.oauth.linkedin.secretKey")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: tenants.length,
    tenants,
  });
});

/**
 * @route   GET /platform/tenants/:id
 * @desc    Get single tenant by ID
 * @access  Private/Platform Admin
 */
export const getTenantById = asyncHandler(async (req, res) => {
  const platformDb = getPlatformConnection();
  const Tenant = platformDb.model("Tenant");

  const tenant = await Tenant.findById(req.params.id).lean();

  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  // Hide decrypted credentials in normal detail retrieval for security
  if (tenant.database) {
    tenant.database.connectionString = "[ENCRYPTED]";
  }
  if (tenant.config?.stripe) {
    tenant.config.stripe.secretKey = tenant.config.stripe.secretKey ? "[ENCRYPTED]" : "";
    tenant.config.stripe.webhookSecret = tenant.config.stripe.webhookSecret ? "[ENCRYPTED]" : "";
  }
  if (tenant.config?.email) {
    tenant.config.email.pass = tenant.config.email.pass ? "[ENCRYPTED]" : "";
  }
  if (tenant.config?.oauth?.google) {
    tenant.config.oauth.google.clientSecret = tenant.config.oauth.google.clientSecret ? "[ENCRYPTED]" : "";
  }
  if (tenant.config?.oauth?.linkedin) {
    tenant.config.oauth.linkedin.secretKey = tenant.config.oauth.linkedin.secretKey ? "[ENCRYPTED]" : "";
  }

  res.status(200).json({
    success: true,
    tenant,
  });
});

/**
 * @route   PUT /platform/tenants/:id
 * @desc    Update tenant configuration
 * @access  Private/Platform Admin
 */
export const updateTenant = asyncHandler(async (req, res) => {
  const platformDb = getPlatformConnection();
  const Tenant = platformDb.model("Tenant");

  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  const updates = req.body;

  // Handle selective config updates safely with encryption
  if (updates.name) tenant.name = updates.name;
  if (updates.domains) tenant.domains = updates.domains;
  if (updates.subscription) tenant.subscription = { ...tenant.subscription, ...updates.subscription };
  
  if (updates.config) {
    if (updates.config.stripe) {
      if (updates.config.stripe.secretKey) {
        tenant.config.stripe.secretKey = encrypt(updates.config.stripe.secretKey);
      }
      if (updates.config.stripe.webhookSecret) {
        tenant.config.stripe.webhookSecret = encrypt(updates.config.stripe.webhookSecret);
      }
      if (updates.config.stripe.publishableKey !== undefined) {
        tenant.config.stripe.publishableKey = updates.config.stripe.publishableKey;
      }
    }

    if (updates.config.email) {
      if (updates.config.email.pass) {
        tenant.config.email.pass = encrypt(updates.config.email.pass);
      }
      if (updates.config.email.user !== undefined) {
        tenant.config.email.user = updates.config.email.user;
      }
      if (updates.config.email.service !== undefined) {
        tenant.config.email.service = updates.config.email.service;
      }
      if (updates.config.email.senderName !== undefined) {
        tenant.config.email.senderName = updates.config.email.senderName;
      }
    }

    if (updates.config.cloudinary) {
      if (updates.config.cloudinary.merchantAccount) {
        tenant.config.cloudinary.merchantAccount = {
          cloudName: updates.config.cloudinary.merchantAccount.cloudName,
          apiKey: updates.config.cloudinary.merchantAccount.apiKey,
          apiSecret: updates.config.cloudinary.merchantAccount.apiSecret
            ? encrypt(updates.config.cloudinary.merchantAccount.apiSecret)
            : tenant.config.cloudinary?.merchantAccount?.apiSecret || '',
        };
      }
      if (updates.config.cloudinary.customerAccount) {
        tenant.config.cloudinary.customerAccount = {
          cloudName: updates.config.cloudinary.customerAccount.cloudName,
          apiKey: updates.config.cloudinary.customerAccount.apiKey,
          apiSecret: updates.config.cloudinary.customerAccount.apiSecret
            ? encrypt(updates.config.cloudinary.customerAccount.apiSecret)
            : tenant.config.cloudinary?.customerAccount?.apiSecret || '',
        };
      }
    }

    if (updates.config.cors) {
      tenant.config.cors = { ...tenant.config.cors, ...updates.config.cors };
    }

    if (updates.config.oauth) {
      if (!tenant.config.oauth) tenant.config.oauth = { google: {}, linkedin: {} };

      if (updates.config.oauth.google) {
        const g = updates.config.oauth.google;
        if (g.clientId !== undefined) tenant.config.oauth.google.clientId = g.clientId;
        if (g.clientSecret) tenant.config.oauth.google.clientSecret = encrypt(g.clientSecret);
        if (g.callbackUrl !== undefined) tenant.config.oauth.google.callbackUrl = g.callbackUrl;
      }

      if (updates.config.oauth.linkedin) {
        const l = updates.config.oauth.linkedin;
        if (l.apiKey !== undefined) tenant.config.oauth.linkedin.apiKey = l.apiKey;
        if (l.secretKey) tenant.config.oauth.linkedin.secretKey = encrypt(l.secretKey);
        if (l.callbackUrl !== undefined) tenant.config.oauth.linkedin.callbackUrl = l.callbackUrl;
      }
    }

    if (updates.config.frontendUrl !== undefined) {
      tenant.config.frontendUrl = updates.config.frontendUrl;
    }
    if (updates.config.merchantPanelUrl !== undefined) {
      tenant.config.merchantPanelUrl = updates.config.merchantPanelUrl;
    }
  }

  await tenant.save();

  res.status(200).json({
    success: true,
    message: "Tenant configuration updated successfully",
    tenant,
  });
});

/**
 * @route   PATCH /platform/tenants/:id/suspend
 * @desc    Suspend tenant store
 * @access  Private/Platform Admin
 */
export const suspendTenant = asyncHandler(async (req, res) => {
  const tenant = await TenantService.suspendTenant(req.params.id);

  res.status(200).json({
    success: true,
    message: "Tenant store suspended successfully",
    tenant,
  });
});

/**
 * @route   PATCH /platform/tenants/:id/activate
 * @desc    Activate tenant store
 * @access  Private/Platform Admin
 */
export const activateTenant = asyncHandler(async (req, res) => {
  const tenant = await TenantService.activateTenant(req.params.id);

  res.status(200).json({
    success: true,
    message: "Tenant store reactivated successfully",
    tenant,
  });
});

/**
 * @route   DELETE /platform/tenants/:id
 * @desc    Soft-delete tenant store
 * @access  Private/Platform Admin
 */
export const deleteTenant = asyncHandler(async (req, res) => {
  const tenant = await TenantService.deleteTenant(req.params.id);

  res.status(200).json({
    success: true,
    message: "Tenant store soft-deleted successfully",
    tenant,
  });
});

/**
 * @route   GET /platform/tenants/:id/stats
 * @desc    Get tenant specific operational statistics
 * @access  Private/Platform Admin
 */
export const getTenantStats = asyncHandler(async (req, res) => {
  const stats = await TenantService.getTenantStats(req.params.id);

  res.status(200).json({
    success: true,
    stats,
  });
});

/**
 * @route   GET /platform/overview
 * @desc    Get platform level overview statistics
 * @access  Private/Platform Admin
 */
export const getPlatformOverview = asyncHandler(async (req, res) => {
  const platformDb = getPlatformConnection();
  const Tenant = platformDb.model("Tenant");

  const [totalStores, planGroups, statusGroups] = await Promise.all([
    Tenant.countDocuments({}),
    Tenant.aggregate([
      { $group: { _id: "$subscription.plan", count: { $sum: 1 } } }
    ]),
    Tenant.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ])
  ]);

  res.status(200).json({
    success: true,
    overview: {
      totalStores,
      plansDistribution: planGroups.reduce((acc, curr) => {
        acc[curr._id || 'unknown'] = curr.count;
        return acc;
      }, {}),
      statusDistribution: statusGroups.reduce((acc, curr) => {
        acc[curr._id || 'unknown'] = curr.count;
        return acc;
      }, {}),
    }
  });
});

/**
 * @route   DELETE /platform/tenants/:id/permanent
 * @desc    Permanently delete a soft-deleted tenant (drops DB + removes record)
 * @access  Private/Platform Admin
 */
export const permanentDeleteTenant = asyncHandler(async (req, res) => {
  const confirmParam = req.query.confirm;
  if (confirmParam !== 'PERMANENT_DELETE') {
    throw new AppError("Safety confirmation required. Add ?confirm=PERMANENT_DELETE to the request.", 400);
  }

  const result = await TenantService.permanentDeleteTenant(req.params.id);

  res.status(200).json({
    success: true,
    message: `Tenant "${result.name}" (${result.slug}) permanently deleted. Database dropped.`,
  });
});

/**
 * @route   PUT /platform/tenants/:id/owner
 * @desc    Update the store owner's login email and/or password
 * @access  Private/Platform Admin
 */
export const updateTenantOwner = asyncHandler(async (req, res) => {
  const { email, password, name, username } = req.body;
  const ownerName = name || username;

  if (!email && !password && !ownerName) {
    throw new AppError("Provide at least an email, password, or name to update.", 400);
  }

  if (password && password.length < 6) {
    throw new AppError("Password must be at least 6 characters long.", 400);
  }

  if (ownerName && ownerName.trim().length === 0) {
    throw new AppError("Owner name cannot be empty.", 400);
  }

  // 1. Find the tenant in Platform DB
  const platformDb = getPlatformConnection();
  const Tenant = platformDb.model("Tenant");
  const tenant = await Tenant.findById(req.params.id);

  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  // 2. Connect to the tenant's isolated database
  const connectionString = decrypt(tenant.database.connectionString);
  if (!connectionString) {
    throw new AppError("Unable to decrypt tenant database connection.", 500);
  }

  const tenantConnection = await getTenantConnection(tenant._id.toString(), connectionString);
  const User = tenantConnection.model("User");
  const Role = tenantConnection.model("Role");

  // 3. Find the owner user (role.name === "owner")
  const ownerRole = await Role.findOne({ name: "owner" });
  if (!ownerRole) {
    throw new AppError("Owner role not found in tenant database.", 500);
  }

  const ownerUser = await User.findOne({ role: ownerRole._id });
  if (!ownerUser) {
    throw new AppError("Owner user account not found in tenant database.", 404);
  }

  // 4. Update email if provided
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicates (another user with that email in the same tenant DB)
    const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: ownerUser._id } });
    if (duplicate) {
      throw new AppError("This email is already used by another user in this store.", 409);
    }

    ownerUser.email = normalizedEmail;

    // Sync the Platform DB metadata
    tenant.owner.email = normalizedEmail;
  }

  // 5. Update name if provided
  if (ownerName) {
    ownerUser.username = ownerName.trim();
    tenant.owner.name = ownerName.trim();
  }

  // 6. Update password if provided
  if (password) {
    ownerUser.password = await bcrypt.hash(password, 10);
  }

  // 7. Save both records
  await ownerUser.save({ validateBeforeSave: false });
  await tenant.save();

  res.status(200).json({
    success: true,
    message: `Owner credentials updated successfully for store "${tenant.name}".`,
    owner: {
      email: ownerUser.email,
      username: ownerUser.username,
    },
  });
});

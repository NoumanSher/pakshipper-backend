import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },               // e.g., "My Fashion Store"
  slug: { type: String, required: true, unique: true },  // e.g., "my-fashion-store"
  domains: [{
    domain: { type: String, required: true }, // e.g., "mystore.com" or "mystore.pakshipper.com"
    type: { type: String, enum: ['subdomain', 'custom'], required: true },
    isPrimary: { type: Boolean, default: false },
    sslEnabled: { type: Boolean, default: true },
    verifiedAt: { type: Date },
  }],
  database: {
    connectionString: { type: String, required: true },  // MongoDB URI (encrypted)
    name: { type: String, required: true },
  },
  owner: {
    email: { type: String, required: true },
    name: { type: String, required: true },
  },
  config: {
    stripe: {
      secretKey: { type: String },         // Encrypted
      webhookSecret: { type: String },     // Encrypted
      publishableKey: { type: String },
    },
    cloudinary: {
      customerAccount: { cloudName: String, apiKey: String, apiSecret: String },  // Customer review images
      merchantAccount: { cloudName: String, apiKey: String, apiSecret: String },  // Store/product images
    },
    email: {
      service: { type: String, default: 'gmail' },
      user: { type: String },
      pass: { type: String },              // Encrypted
      senderName: { type: String },
    },
    oauth: {
      google: { clientId: String, clientSecret: String, callbackUrl: String }, // clientSecret Encrypted
      linkedin: { apiKey: String, secretKey: String, callbackUrl: String },    // secretKey Encrypted
    },
    cors: {
      allowedOrigins: [String],            // ["https://mystore.com", "https://admin.mystore.com"]
    },
    frontendUrl: { type: String },         // "https://mystore.com"
    merchantPanelUrl: { type: String },    // "https://admin.mystore.com"
  },
  subscription: {
    plan: { type: String, enum: ['trial', 'basic', 'pro', 'enterprise'], default: 'trial' },
    status: { type: String, enum: ['active', 'suspended', 'cancelled'], default: 'active' },
    expiresAt: { type: Date },
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'provisioning', 'deleted'],
    default: 'provisioning'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAdmin' }, // Super Admin who created it
  provisioningError: { type: String }, // Details of error if provisioning failed
}, { timestamps: true });

tenantSchema.index({ 'domains.domain': 1 });
tenantSchema.index({ status: 1 });

export default mongoose.model("Tenant", tenantSchema);

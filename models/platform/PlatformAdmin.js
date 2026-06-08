import mongoose from "mongoose";

const platformAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['super_admin', 'support', 'billing'],
    default: 'super_admin'
  },
  refreshToken: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("PlatformAdmin", platformAdminSchema);

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getPlatformConnection } from "../../config/platformConnection.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import { z } from "zod";

const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const generatePlatformTokens = (admin) => {
  const secret = process.env.PLATFORM_JWT_SECRET || process.env.SECRET_KEY || 'platform-default-secret';
  const refreshSecret = process.env.PLATFORM_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET || "platform_refresh_secret";

  const accessToken = jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      isPlatformAdmin: true
    },
    secret,
    { expiresIn: "1h" } // Longer session for platform admins
  );

  const refreshToken = jwt.sign(
    { id: admin._id, isPlatformAdmin: true },
    refreshSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

/**
 * @route   POST /platform/auth/login
 * @desc    Platform Admin login
 * @access  Public
 */
export const loginPlatformAdmin = asyncHandler(async (req, res) => {
  const { email, password } = platformLoginSchema.parse(req.body);

  const platformDb = getPlatformConnection();
  const PlatformAdmin = platformDb.model("PlatformAdmin");

  const admin = await PlatformAdmin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    throw new AppError("Invalid email or password", 400);
  }

  if (!admin.isActive) {
    throw new AppError("Account is suspended", 403);
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 400);
  }

  const tokens = generatePlatformTokens(admin);
  admin.refreshToken = tokens.refreshToken;
  await admin.save();

  const adminObject = admin.toObject();
  delete adminObject.password;
  delete adminObject.refreshToken;

  res.status(200).json({
    success: true,
    message: "Platform login successful",
    admin: adminObject,
    ...tokens,
  });
});

/**
 * @route   POST /platform/auth/refresh-token
 * @desc    Refresh platform admin access token
 * @access  Public
 */
export const refreshPlatformToken = asyncHandler(async (req, res) => {
  const { refreshToken: oldRefreshToken } = req.body;

  if (!oldRefreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  const refreshSecret = process.env.PLATFORM_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET || "platform_refresh_secret";

  try {
    const decoded = jwt.verify(oldRefreshToken, refreshSecret);
    
    if (!decoded.isPlatformAdmin) {
      throw new AppError("Invalid refresh token type", 401);
    }

    const platformDb = getPlatformConnection();
    const PlatformAdmin = platformDb.model("PlatformAdmin");

    const admin = await PlatformAdmin.findById(decoded.id);
    if (!admin || admin.refreshToken !== oldRefreshToken) {
      throw new AppError("Invalid refresh token", 401);
    }

    if (!admin.isActive) {
      throw new AppError("Account is suspended", 403);
    }

    const tokens = generatePlatformTokens(admin);
    admin.refreshToken = tokens.refreshToken;
    await admin.save();

    res.status(200).json({
      success: true,
      ...tokens,
    });
  } catch (error) {
    throw new AppError("Invalid refresh token", 401);
  }
});

/**
 * @route   GET /platform/auth/me
 * @desc    Get current platform admin profile
 * @access  Private/Platform Admin
 */
export const getPlatformMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    admin: req.platformAdmin,
  });
});

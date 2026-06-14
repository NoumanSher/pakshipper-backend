import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import { createEmailService } from "./emailFactory.js";

class AuthService {
  /**
   * Register a new user.
   */
  static async register(models, userData) {
    const { User, Role } = models;
    const { email, username, mobilePhone, password, confirmPassword } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("User already registered", 400);

    // Passwords match check
    if (password !== confirmPassword) throw new AppError("Passwords do not match", 400);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get default role
    const userRole = await Role.findOne({ name: "customer" }); // Updated default to 'customer'
    if (!userRole) throw new AppError("Default user role not found. Please run seed script.", 500);

    // Create and save user
    const newUser = new User({
      email,
      username,
      mobilePhone,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: userRole._id,
    });

    await newUser.save();

    const tokens = this.generateTokens(newUser, userRole);
    newUser.refreshToken = tokens.refreshToken;
    await newUser.save();

    const { password: _, refreshToken: __, ...userWithoutPassword } = newUser.toObject();

    return { user: userWithoutPassword, ...tokens };
  }

  /**
   * Login a user.
   * @param {object} models - Tenant-specific Mongoose models
   * @param {string} email
   * @param {string} password
   * @param {boolean} [merchantPanelMode=false] - When true (X-Tenant-Slug present on request),
   *   blocks customer-level users from accessing the merchant panel.
   */
  static async login(models, email, password, merchantPanelMode = false) {
    const { User } = models;
    const user = await User.findOne({ email }).populate("role");
    if (!user) throw new AppError("Invalid email or password", 400);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AppError("Invalid email or password", 400);

    // Block customer-level users from the merchant panel
    if (merchantPanelMode) {
      const roleLevel = user.role?.level ?? 0;
      if (roleLevel < 10) {
        throw new AppError(
          "Access denied. Your account does not have merchant panel access.",
          403
        );
      }
    }

    const tokens = this.generateTokens(user, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    const { password: _, refreshToken: __, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, ...tokens };
  }

  /**
   * Refresh access token.
   */
  static async refreshToken(models, oldRefreshToken) {
    const { User } = models;
    try {
      const decoded = jwt.verify(oldRefreshToken, process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey");
      const user = await User.findById(decoded.id).populate("role");

      if (!user || user.refreshToken !== oldRefreshToken) {
        throw new AppError("Invalid refresh token", 401);
      }

      const tokens = this.generateTokens(user, user.role);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch (error) {
      throw new AppError("Invalid refresh token", 401);
    }
  }

  /**
   * Handle forgot password.
   */
  static async forgotPassword(models, tenantConfig, email) {
    const { User } = models;
    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email not found", 400);

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: "1hr" });

    await user.updateOne({
      resetToken: token,
      resetTokenExpiration: Date.now() + 3600000,
    });

    const subject = "Password Reset Request";
    const text = `You requested a password reset. Please use the following token: ${token}`;
    const frontendUrl = tenantConfig.frontendUrl || process.env.FRONTEND_URL;
    const html = `<p>You requested a password reset. Please click on the following link to reset your password:</p>
                  <a href="${frontendUrl}/reset-password?token=${token}">Reset Password</a>`;

    const emailService = createEmailService(tenantConfig.email);
    await emailService.sendEmail(user.email, subject, text, html);
    return true;
  }

  /**
   * Handle reset password.
   */
  static async resetPassword(models, tenantConfig, token, newPassword, confirmPassword) {
    const { User } = models;
    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      const user = await User.findById(decoded.userId);

      if (!user || user.resetToken !== token || Date.now() > user.resetTokenExpiration) {
        throw new AppError("Invalid or expired token", 400);
      }

      if (newPassword !== confirmPassword) {
        throw new AppError("Passwords do not match", 400);
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetToken = undefined;
      user.resetTokenExpiration = undefined;
      await user.save();

      const subject = "Password Reset Confirmation";
      const text = `Hello, your password has been successfully reset.`;
      const html = `<b>Hello,</b><br>Your password has been successfully reset.`;
      
      const emailService = createEmailService(tenantConfig.email);
      await emailService.sendEmail(user.email, subject, text, html);

      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Invalid or expired token", 400);
    }
  }

  /**
   * Helper to generate tokens.
   */
  static generateTokens(user, role) {
    const accessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: role?.name || "customer",
        roleLevel: role?.level || 0,
      },
      process.env.SECRET_KEY,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey",
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }
}

export default AuthService;

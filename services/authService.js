import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user-schema.js";
import Role from "../models/Role.js";
import AppError from "../utils/AppError.js";
import { sendEmail } from "./email-service.js";

class AuthService {
  /**
   * Register a new user.
   */
  static async register(userData) {
    const { email, username, mobilePhone, password, confirmPassword } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("User already registered", 400);

    // Passwords match check
    if (password !== confirmPassword) throw new AppError("Passwords do not match", 400);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get default role
    const userRole = await Role.findOne({ name: "user" });
    if (!userRole) throw new AppError("Default user role not found. Please run seed script.", 500);

    // Create and save user
    const newUser = new User({
      email,
      username,
      mobilePhone,
      password: hashedPassword,
      confirmPassword: hashedPassword, // Note: Schema might require this, though hashing it is odd for confirmation.
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
   */
  static async login(email, password) {
    const user = await User.findOne({ email }).populate("role");
    if (!user) throw new AppError("Invalid email or password", 400);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AppError("Invalid email or password", 400);

    const tokens = this.generateTokens(user, user.role);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    const { password: _, refreshToken: __, ...userWithoutPassword } = user.toObject();

    return { user: userWithoutPassword, ...tokens };
  }

  /**
   * Refresh access token.
   */
  static async refreshToken(oldRefreshToken) {
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
  static async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email not found", 400);

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: "1hr" });

    await user.updateOne({
      resetToken: token,
      resetTokenExpiration: Date.now() + 3600000,
    });

    const subject = "Password Reset Request";
    const text = `You requested a password reset. Please use the following token: ${token}`;
    const html = `<p>You requested a password reset. Please click on the following link to reset your password:</p>
                  <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">Reset Password</a>`;

    await sendEmail(user.email, subject, text, html);
    return true;
  }

  /**
   * Handle reset password.
   */
  static async resetPassword(token, newPassword, confirmPassword) {
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
      await sendEmail(user.email, subject, text, html);

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
        role: role?.name || "user",
        permissions: role?.permissions || [],
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

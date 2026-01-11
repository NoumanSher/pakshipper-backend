import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../models/user-schema.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * @route   POST /api/auth/login-user
 * @desc    Authenticate user and return token
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with user data and JWT token
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate access token (short-lived)
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "15m" } // Access token valid for 15 minutes
    );

    // Generate refresh token (long-lived)
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey",
      { expiresIn: "7d" } // Refresh token valid for 7 days
    );

    // Store refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    // Exclude password and refreshToken from returned user object (for security, or you can include it if needed)
    const { password: _, refreshToken: __, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      message: "Login successful",
      data: userWithoutPassword,
      token,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
};

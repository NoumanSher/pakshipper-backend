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

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Exclude password from returned user object
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      message: "Login successful",
      data: userWithoutPassword,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
};

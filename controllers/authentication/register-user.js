import bcrypt from "bcrypt";
import User from "../../models/user-schema.js";
import Role from "../../models/Role.js";
import jwt from "jsonwebtoken";

/**
 * @route   POST /api/auth/register-user
 * @desc    Register a new user
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const registerUser = async (req, res) => {
  try {
    const { email, username, mobilePhone, password, confirmPassword } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already registered", data: existingUser });
    }

    // Check if password and confirmPassword match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get the default "user" role
    const userRole = await Role.findOne({ name: "user" });
    if (!userRole) {
      return res.status(500).json({ message: "Default user role not found. Please run seed script." });
    }

    // Create new user
    const newUser = new User({
      email,
      username,
      mobilePhone,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: userRole._id,
    });

    // Save the user
    await newUser.save();

    // Generate token with populated role info
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        role: userRole.name,
        permissions: userRole.permissions,
      },
      process.env.SECRET_KEY,
      { expiresIn: "15m" }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: newUser._id },
      process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey",
      { expiresIn: "7d" }
    );

    // Store refresh token in user document
    newUser.refreshToken = refreshToken;
    await newUser.save();

    // Exclude password and refreshToken from returned user object
    const { password: _, refreshToken: __, ...userWithoutPassword } = newUser.toObject();

    res.status(201).json({
      message: "User registered successfully",
      data: userWithoutPassword,
      token,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error });
  }
};

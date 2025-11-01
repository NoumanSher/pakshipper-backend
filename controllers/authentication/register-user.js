import bcrypt from "bcrypt";
import User from "../../models/user-schema.js";

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

    // Create new user
    const newUser = new User({
      email,
      username,
      mobilePhone,
      password: hashedPassword,
      confirmPassword: hashedPassword, // Note: This could be removed to avoid redundant storage
    });

    // Save the user
    await newUser.save();

    res
      .status(201)
      .json({ message: "User registered successfully", data: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error });
  }
};

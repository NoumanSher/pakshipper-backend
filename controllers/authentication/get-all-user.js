import User from "../../models/user-schema.js";

/**
 * @route   GET /api/auth/all
 * @desc    Fetches all registered users (excluding passwords)
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response containing all users (without password fields)
 */
export const getAllUsers = async (req, res) => {
  try {
    // Fetch all users excluding password field
    const users = await User.find({}, "-password");

    res.status(200).json({
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error,
    });
  }
};

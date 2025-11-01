import User from "../../models/user-schema.js";

/**
 * @route   GET /api/auth/user-data/:id
 * @desc    Fetch user by ID (excluding password)
 * @access  Protected
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with user data or error message
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch user by ID and exclude the password field
    const user = await User.findById(id, "-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User fetched successfully", data: user });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

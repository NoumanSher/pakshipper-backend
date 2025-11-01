import bcrypt from "bcrypt";
import User from "../../models/user-schema.js";

/**
 * @route   PUT /api/auth/update-user/:id
 * @desc    Update user information (email, username, role, mobilePhone)
 * @access  Protected
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with updated user data or error message
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, username, mobilePhone, role } = req.body;

    // Find user by ID, exclude password from result
    const user = await User.findById(id, "-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields if provided
    user.email = email || user.email;
    user.username = username || user.username;
    user.role = role || user.role;
    user.mobilePhone = mobilePhone || user.mobilePhone;

    await user.save();

    res.status(200).json({ message: "User updated successfully", data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

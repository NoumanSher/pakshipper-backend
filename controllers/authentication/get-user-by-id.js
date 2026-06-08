import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/auth/user-data/:id
 * @desc    Fetch user by ID (excluding password)
 * @access  Protected
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with user data or error message
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await UserService.getUserById(req.models, id);

  res.status(200).json({ message: "User fetched successfully", data: user });
});

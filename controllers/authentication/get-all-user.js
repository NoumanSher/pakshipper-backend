import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/auth/all
 * @desc    Fetches all registered users (excluding passwords)
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response containing all users (without password fields)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await UserService.getAllUsers(req.models);

  res.status(200).json({
    message: "Users fetched successfully",
    data: users,
  });
});

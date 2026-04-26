import UserService from '../../services/userService.js';
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

/**
 * Get the current authenticated user via JWT
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) throw new AppError('Not authenticated', 401);

  const user = await UserService.getUserById(userId);
  res.status(200).json({ message: 'login successfully', data: user });
});

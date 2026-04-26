import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).optional(),
  mobilePhone: z.string().optional(),
  role: z.string().optional(),
});

/**
 * @route   PUT /api/auth/update-user/:id
 * @desc    Update user information (email, username, role, mobilePhone)
 * @access  Protected
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with updated user data or error message
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = updateUserSchema.parse(req.body);
  const updatedUser = await UserService.updateUser(id, validatedData);

  res.status(200).json({ message: "User updated successfully", data: updatedUser });
});

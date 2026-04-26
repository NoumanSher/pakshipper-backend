import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const adminCreateUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  mobilePhone: z.string().optional(),
  password: z.string().min(6),
  roleName: z.string().optional(),
});

/**
 * @route   POST /api/auth/admin/create-user
 * @desc    Admin can create a user with a specific role
 * @access  Private (Admin only)
 */
export const adminCreateUser = asyncHandler(async (req, res) => {
  const validatedData = adminCreateUserSchema.parse(req.body);
  const populatedUser = await UserService.adminCreateUser(validatedData);

  res.status(201).json({
    message: "User created successfully by admin",
    data: populatedUser,
  });
});

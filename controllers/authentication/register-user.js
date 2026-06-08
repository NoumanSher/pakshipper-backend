import AuthService from "../../services/authService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  mobilePhone: z.string().optional(),
  password: z.string().min(6),
  confirmPassword: z.string(),
});

/**
 * @route   POST /api/auth/register-user
 * @desc    Register a new user
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const registerUser = asyncHandler(async (req, res) => {
  const validatedData = registerSchema.parse(req.body);
  const result = await AuthService.register(req.models, validatedData);

  res.status(201).json({
    message: "User registered successfully",
    data: result.user,
    token: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

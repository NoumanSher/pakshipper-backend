import AuthService from "../../services/authService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * @route   POST /api/auth/login-user
 * @desc    Authenticate user and return token
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with user data and JWT token
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await AuthService.login(req.models, email, password);

  res.status(200).json({
    message: "Login successful",
    data: result.user,
    token: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

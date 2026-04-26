import AuthService from "../../services/authService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const refreshTokenSchema = z.object({
  token: z.string(),
});

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renew access token using a refresh token
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { token } = refreshTokenSchema.parse(req.body);
  const result = await AuthService.refreshToken(token);

  res.status(200).json(result);
});

import AuthService from "../../services/authService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * @route   POST /api/auth/forget-password
 * @desc    Generates a password reset token and sends it to the user's email
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.body.email - User's email address
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const forgetPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await AuthService.forgotPassword(req.models, req.tenantConfig, email);

  res.status(200).json({
    message: "Password reset token sent to your email",
  });
});

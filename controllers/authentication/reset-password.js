import AuthService from "../../services/authService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
  confirmPassword: z.string(),
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset a user's password using a valid reset token
 * @access  Protected (requires token in request body)
 * @param   {Object} req - Express request object
 * @param   {string} req.body.token - JWT token sent via email
 * @param   {string} req.body.newPassword - New password to set
 * @param   {string} req.body.confirmPassword - Password confirmation
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, confirmPassword } = resetPasswordSchema.parse(req.body);
  await AuthService.resetPassword(token, newPassword, confirmPassword);

  res.status(200).json({ message: "Password reset successfully" });
});

import bcrypt from "bcrypt";
import User from "../../models/user-schema.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../services/email-service.js";

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
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Verify the token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.userId;

    // Find the user and validate token expiration
    const user = await User.findById(userId);
    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== token ||
      Date.now() > user.resetTokenExpiration
    ) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user and clear reset fields
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;

    await user.save();

    // Notify user via email
    const subject = "Password Reset Confirmation";
    const text = `Hello, your password has been successfully reset.`;
    const html = `<b>Hello,</b><br>Your password has been successfully reset.`;

    await sendEmail(user.email, subject, text, html);

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

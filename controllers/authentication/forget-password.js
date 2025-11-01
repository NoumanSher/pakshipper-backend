import User from "../../models/user-schema.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../services/email-service.js";

/**
 * @route   POST /api/auth/forget-password
 * @desc    Generates a password reset token and sends it to the user's email
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {string} req.body.email - User's email address
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }

    // Create reset token
    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });

    // Update user with reset token and expiration
    await user.updateOne({
      resetToken: token,
      resetTokenExpiration: Date.now() + 3600000, // 1 hour
    });

    // Send email with reset link
    const subject = "Password Reset Request";
    const text = `You requested a password reset. Please use the following token: ${token}`;
    const html = `<p>You requested a password reset. Please click on the following link to reset your password:</p>
                  <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">Reset Password</a>`;

    await sendEmail(user.email, subject, text, html);

    res.status(200).json({
      message: "Password reset token sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error sending password reset token",
      error,
    });
  }
};

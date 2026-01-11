import jwt from "jsonwebtoken";
import User from "../../models/user-schema.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renew access token using a refresh token
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 */
export const refreshToken = async (req, res) => {
    try {
        const { token: providedRefreshToken } = req.body;

        if (!providedRefreshToken) {
            return res.status(401).json({ message: "Refresh token is required" });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            providedRefreshToken,
            process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey"
        );

        // Find user and check if the stored refresh token matches
        const user = await User.findById(decoded.id);
        if (!user || user.refreshToken !== providedRefreshToken) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.SECRET_KEY,
            { expiresIn: "15m" }
        );

        // Optional: Generate a new refresh token (refresh token rotation)
        const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.REFRESH_TOKEN_SECRET || "refresh_secret_hey",
            { expiresIn: "7d" }
        );

        user.refreshToken = newRefreshToken;
        await user.save();

        res.status(200).json({
            accessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(403).json({ message: "Refresh token expired. Please log in again." });
        }
        res.status(403).json({ message: "Invalid refresh token", error: error.message });
    }
};

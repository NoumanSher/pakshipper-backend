import User from "../../models/user-schema.js";

/**
 * @route   DELETE /api/auth/delete-user/:id
 * @desc    Delete a single user by ID
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Delete the user
        await User.findByIdAndDelete(id);

        res.status(200).json({
            message: "User deleted successfully",
            deletedUserId: id
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            message: "Error deleting user",
            error: error.message,
        });
    }
};

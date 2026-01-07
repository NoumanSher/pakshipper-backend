import User from "../../models/user-schema.js";

/**
 * @route   DELETE /api/auth/delete-users
 * @desc    Delete multiple users by IDs
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                message: "Please provide an array of user IDs to delete"
            });
        }

        // Delete users where _id is in the ids array
        const result = await User.deleteMany({
            _id: { $in: ids }
        });

        res.status(200).json({
            message: "Users deleted successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Error bulk deleting users:", error);
        res.status(500).json({
            message: "Error deleting users",
            error: error.message,
        });
    }
};

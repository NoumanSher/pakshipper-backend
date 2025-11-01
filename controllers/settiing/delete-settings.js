import Settings from "../../models/settings.js";

/**
 * @route   DELETE /api/settings
 * @desc    Deletes the settings document from the database
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const deleteSettings = async (req, res) => {
    try {
        await Settings.deleteOne(); // Deletes the first matching document (expected to be one)
        res.status(200).json({ message: "Settings deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting settings", error });
    }
};

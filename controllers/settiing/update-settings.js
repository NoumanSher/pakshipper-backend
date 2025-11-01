import Settings from "../../models/settings.js";

/**
 * @route   PUT /api/settings/update
 * @desc    Updates the settings document. If it doesn't exist, creates a new one.
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object, expects updated settings in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response containing the updated (or newly created) settings
 */
export const updateSettings = async (req, res) => {
    try {
        const updatedSettings = await Settings.findOneAndUpdate(
            {}, // Empty filter to update the first (and only) settings document
            req.body,
            { new: true, upsert: true } // `upsert` creates if not found
        );
        res.status(200).json({ message: "Settings updated", data: updatedSettings });
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error });
    }
};

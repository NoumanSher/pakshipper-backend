import Settings from "../../models/settings.js";

/**
 * @route   GET /api/settings/
 * @desc    Retrieves the current application settings
 * @access  Public or Private (based on route protection)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with settings data or error message
 */
export const getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne();

        if (!settings) {
            return res.status(404).json({ message: "Settings not found" });
        }

        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving settings", error });
    }
};

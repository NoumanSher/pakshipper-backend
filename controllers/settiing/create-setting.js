import Settings from "../../models/settings.js";

/**
 * @route   POST /api/settings/create
 * @desc    Creates new settings or updates existing settings
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object, expects settings data in req.body
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with newly created or updated settings
 */
export const createOrUpdateSettings = async (req, res) => {
    try {
        // Attempt to find existing settings
        const existingSettings = await Settings.findOne();

        if (existingSettings) {
            // If settings exist, update them
            const updatedSettings = await Settings.findOneAndUpdate(
                {},
                req.body,
                { new: true } // Return the updated document
            );
            return res.status(200).json({ message: "Settings updated", data: updatedSettings });
        }

        // If no settings exist, create a new one
        const newSettings = new Settings(req.body);
        await newSettings.save();

        res.status(201).json({ message: "Settings created", data: newSettings });
    } catch (error) {
        res.status(500).json({ message: "Error creating or updating settings", error });
    }
};

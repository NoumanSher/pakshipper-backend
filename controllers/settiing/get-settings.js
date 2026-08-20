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
        const { Settings } = req.models;
        
        const settings = await Settings.findOne().lean();

        if (!settings) {
            return res.status(404).json({ message: "Settings not found" });
        }

        if (!settings.shippingSetting) {
            settings.shippingSetting = {
                shippingType: 'free',
                flatRate: 0,
                freeShippingMinAmount: 2000,
                shippingLabel: 'Standard Delivery',
                freeShippingText: 'Free Delivery'
            };
        }

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving settings", error });
    }
};

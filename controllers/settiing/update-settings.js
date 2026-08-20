import { deleteMultipleFromCloudinary } from "../../utils/cloudinaryHelper.js";
import { getCloudinaryConfig } from "../../services/cloudinaryFactory.js";
import { adminConfig } from "../../utils/cloudinaryAdmin.js";

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
        const { Settings } = req.models;
        const oldSettings = await Settings.findOne();

        const { lastKnownUpdatedAt, ...bodyData } = req.body;

        // Concurrency conflict check: if client sent lastKnownUpdatedAt and document was updated since
        if (
            lastKnownUpdatedAt &&
            oldSettings?.updatedAt &&
            new Date(oldSettings.updatedAt).getTime() > new Date(lastKnownUpdatedAt).getTime() + 1000
        ) {
            return res.status(409).json({
                message: "Settings have been modified by another administrator. Please refresh the page to load the latest changes.",
                latestUpdatedAt: oldSettings.updatedAt,
            });
        }

        const updateData = { ...bodyData };
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        // Enforce maximum 6 links per footer navigation section
        if (Array.isArray(updateData.footerLinks)) {
            for (const section of updateData.footerLinks) {
                if (Array.isArray(section.items) && section.items.length > 6) {
                    return res.status(400).json({
                        message: `Footer navigation section "${section.title || 'Links'}" cannot contain more than 6 links.`,
                    });
                }
            }
        }

        const filter = oldSettings ? { _id: oldSettings._id } : {};

        const updatedSettings = await Settings.findOneAndUpdate(
            filter,
            updateData,
            { new: true, upsert: true, runValidators: true }
        ).lean();
        
        // Find deleted images and remove from Cloudinary
        if (oldSettings) {
            const oldUrls = new Set();
            const newUrls = new Set();
            
            // Collect old URLs
            if (oldSettings.logo) oldUrls.add(oldSettings.logo);
            if (oldSettings.bannerImg) oldUrls.add(oldSettings.bannerImg);
            if (oldSettings.bannerImages) {
                oldSettings.bannerImages.forEach(imgObj => {
                    if (imgObj.img) oldUrls.add(imgObj.img);
                });
            }
            if (oldSettings.promoCards) {
                oldSettings.promoCards.forEach(card => {
                    if (card.img) oldUrls.add(card.img);
                });
            }
            
            // Collect new URLs
            if (updatedSettings.logo) newUrls.add(updatedSettings.logo);
            if (updatedSettings.bannerImg) newUrls.add(updatedSettings.bannerImg);
            if (updatedSettings.bannerImages) {
                updatedSettings.bannerImages.forEach(imgObj => {
                    if (imgObj.img) newUrls.add(imgObj.img);
                });
            }
            if (updatedSettings.promoCards) {
                updatedSettings.promoCards.forEach(card => {
                    if (card.img) newUrls.add(card.img);
                });
            }
            
            // Find orphaned URLs (in old but not in new)
            const urlsToDelete = [...oldUrls].filter(url => !newUrls.has(url));
            
            if (urlsToDelete.length > 0) {
                const cloudConfig = getCloudinaryConfig(req.tenantConfig, 'merchant') || adminConfig;
                // Background deletion
                deleteMultipleFromCloudinary(urlsToDelete, cloudConfig).catch(err => 
                    console.error("Background cloudinary deletion failed:", err)
                );
            }
        }

        res.status(200).json({ message: "Settings updated", data: updatedSettings });
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error });
    }
};

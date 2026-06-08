import { deleteMultipleFromCloudinary } from "../../utils/cloudinaryHelper.js";
import { getCloudinaryConfig } from "../../services/cloudinaryFactory.js";
import { adminConfig } from "../../utils/cloudinaryAdmin.js";

/**
 * @route   DELETE /api/settings
 * @desc    Deletes the settings document from the database and associated images from Cloudinary
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const deleteSettings = async (req, res) => {
    try {
        const { Settings } = req.models;
        // Fetch the settings document before deleting it to get the image URLs
        const settings = await Settings.findOne();
        
        if (settings) {
            // Collect all image URLs to delete
            const urlsToDelete = [];
            
            if (settings.logo) urlsToDelete.push(settings.logo);
            if (settings.bannerImg) urlsToDelete.push(settings.bannerImg);
            
            if (settings.bannerImages && settings.bannerImages.length > 0) {
                settings.bannerImages.forEach(imgObj => {
                    if (imgObj.img) urlsToDelete.push(imgObj.img);
                });
            }
            
            if (settings.promoCards && settings.promoCards.length > 0) {
                settings.promoCards.forEach(card => {
                    if (card.img) urlsToDelete.push(card.img);
                });
            }
            
            // Delete images from Cloudinary using admin config
            if (urlsToDelete.length > 0) {
                const cloudConfig = getCloudinaryConfig(req.tenantConfig, 'merchant') || adminConfig;
                await deleteMultipleFromCloudinary(urlsToDelete, cloudConfig);
            }
        }

        await Settings.deleteOne(); // Deletes the first matching document (expected to be one)
        res.status(200).json({ message: "Settings and associated images deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting settings", error });
    }
};

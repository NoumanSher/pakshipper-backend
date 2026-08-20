import { deleteMultipleFromCloudinary } from "../../utils/cloudinaryHelper.js";
import { getCloudinaryConfig } from "../../services/cloudinaryFactory.js";
import { adminConfig } from "../../utils/cloudinaryAdmin.js";

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
        const { Settings } = req.models;
        // Attempt to find existing settings
        const existingSettings = await Settings.findOne();

        if (existingSettings) {
            const updateData = { ...req.body };
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

            // If settings exist, update them
            const updatedSettings = await Settings.findOneAndUpdate(
                { _id: existingSettings._id },
                updateData,
                { new: true, runValidators: true } // Return the updated document
            ).lean();

            // Find deleted images and remove from Cloudinary
            const oldUrls = new Set();
            const newUrls = new Set();
            
            // Collect old URLs
            if (existingSettings.logo) oldUrls.add(existingSettings.logo);
            if (existingSettings.bannerImg) oldUrls.add(existingSettings.bannerImg);
            if (existingSettings.bannerImages) {
                existingSettings.bannerImages.forEach(imgObj => {
                    if (imgObj.img) oldUrls.add(imgObj.img);
                });
            }
            if (existingSettings.promoCards) {
                existingSettings.promoCards.forEach(card => {
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

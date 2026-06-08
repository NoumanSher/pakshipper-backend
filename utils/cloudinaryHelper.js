import cloudinary from "./cloudinary.js";
import { adminConfig } from "./cloudinaryAdmin.js";

/**
 * Extracts the Cloudinary public_id from a given URL.
 * Example URL: https://res.cloudinary.com/cloudname/image/upload/v1234567890/folder/subfolder/image.jpg
 * Returns: folder/subfolder/image
 * @param {string} url - The Cloudinary image URL
 * @returns {string|null} The extracted public_id or null if invalid
 */
export const extractPublicId = (url) => {
    if (!url || typeof url !== "string") return null;

    try {
        // Split by '/upload/'
        const parts = url.split("/upload/");
        if (parts.length < 2) return null; // Not a typical cloudinary upload URL

        // Get everything after '/upload/'
        let pathWithVersion = parts[1];

        // Remove the version tag (e.g., 'v1234567890/')
        let pathWithoutVersion = pathWithVersion;
        if (pathWithVersion.match(/^v\d+\//)) {
            pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, "");
        }

        // Remove the file extension
        const lastDotIndex = pathWithoutVersion.lastIndexOf(".");
        if (lastDotIndex !== -1) {
            return pathWithoutVersion.substring(0, lastDotIndex);
        }

        return pathWithoutVersion;
    } catch (error) {
        console.error("Error extracting public_id from Cloudinary URL:", error);
        return null;
    }
};

/**
 * Deletes an image from Cloudinary using the extracted public_id.
 * @param {string} url - The Cloudinary image URL
 * @param {boolean|Object} configOption - The custom Cloudinary config object OR boolean for using admin config
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export const deleteFromCloudinary = async (url, configOption = false) => {
    const publicId = extractPublicId(url);
    if (!publicId) return false;

    try {
        let config;
        if (configOption && typeof configOption === "object") {
            config = configOption;
        } else {
            config = configOption ? adminConfig : undefined;
        }
        // If config is provided, pass it to destroy. Otherwise use the default setup.
        // Cloudinary v2 api takes options as the second argument.
        const result = await cloudinary.uploader.destroy(publicId, config);
        
        if (result.result === "ok" || result.result === "not found") {
             // "not found" means it's already deleted or doesn't exist, which is fine
             return true;
        }
        return false;
    } catch (error) {
        console.error(`Failed to delete image from Cloudinary (publicId: ${publicId}):`, error);
        return false;
    }
};

/**
 * Deletes multiple images from Cloudinary.
 * @param {Array<string>} urls - Array of Cloudinary image URLs
 * @param {boolean|Object} configOption - The custom Cloudinary config object OR boolean for using admin config
 * @returns {Promise<void>}
 */
export const deleteMultipleFromCloudinary = async (urls, configOption = false) => {
    if (!urls || !Array.isArray(urls)) return;
    
    // Process deletions in parallel
    const deletePromises = urls.map(url => deleteFromCloudinary(url, configOption));
    await Promise.allSettled(deletePromises);
};

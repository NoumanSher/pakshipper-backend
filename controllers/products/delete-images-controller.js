import cloudinaryAdmin from "../../utils/cloudinaryAdmin.js";
import client from "../../config/redis/redisClient.js";

/**
 * Delete single image from Cloudinary
 * @route   DELETE /api/admin/images/:publicId
 * @access  Private (Admin only)
 */
export const deleteSingleImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    // Delete from Cloudinary
    const result = await cloudinaryAdmin.uploader.destroy(publicId);

    if (result.result === "ok") {
      // Invalidate cache
      await client.flushAll();
      
      res.status(200).json({
        success: true,
        message: "Image deleted successfully from Cloudinary",
        publicId: publicId,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to delete image from Cloudinary",
        result: result,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting image",
      error: error.message,
    });
  }
};

/**
 * Delete multiple images from Cloudinary (bulk deletion)
 * @route   DELETE /api/admin/images/bulk
 * @access  Private (Admin only)
 */
export const deleteBulkImages = async (req, res) => {
  try {
    const { publicIds } = req.body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "publicIds array is required and must not be empty",
      });
    }

    // Delete multiple images from Cloudinary
    const result = await cloudinaryAdmin.api.delete_resources(publicIds);

    // Invalidate cache
    await client.flushAll();

    res.status(200).json({
      success: true,
      message: "Images deleted successfully from Cloudinary",
      deletedCount: result.deleted ? Object.keys(result.deleted).length : 0,
      details: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting images",
      error: error.message,
    });
  }
};

// routes/admin-upload-routes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";
import uploadAdminMiddleware from "../middlewares/uploadAdminMiddleware.js";

const router = express.Router();

/**
 * @route   POST /api/admin/upload-images
 * @desc    Upload multiple images for e-commerce store (products, categories, etc.)
 * @access  Private (Admin only)
 * @param   {string} folder - Query parameter for folder path (e.g., 'products', 'categories')
 */
router.post(
    "/upload-images",
    authMiddleware,
    checkPermission("write:products"),
    uploadAdminMiddleware("images", "ecommerce"),
    (req, res) => {
        try {
            res.status(200).json({
                success: true,
                message: "Images uploaded successfully",
                images: req.cloudinaryAdminUrls,
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Error processing upload response",
                error: err.message,
            });
        }
    }
);

export default router;

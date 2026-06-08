// routes/delete-images-routes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";
import { deleteSingleImage, deleteBulkImages } from "../controllers/products/delete-images-controller.js";

const router = express.Router();

/**
 * @route   DELETE /api/admin/images/bulk
 * @desc    Delete multiple images from Cloudinary in bulk
 * @access  Private (Admin only)
 * @body    { publicIds: ["id1", "id2", "id3"] }
 */
router.delete(
  "/images/bulk",
  authMiddleware,
  checkPermission("products", "delete"),
  deleteBulkImages
);

/**
 * @route   DELETE /api/admin/images/:publicId
 * @desc    Delete single image from Cloudinary
 * @access  Private (Admin only)
 */
router.delete(
  "/images/:publicId",
  authMiddleware,
  checkPermission("products", "delete"),
  deleteSingleImage
);

/**
 * @route   DELETE /api/admin/delete-image?publicId=folder/image
 * @desc    Delete single image from Cloudinary using query param (avoids slash issues in URL)
 * @access  Private (Admin only)
 */
router.delete(
  "/delete-image",
  authMiddleware,
  checkPermission("products", "delete"),
  deleteSingleImage
);

export default router;

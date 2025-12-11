// routes/delete-images-routes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import roleMiddleware from "../middlewares/roleMiddleWare.js";
import { deleteSingleImage, deleteBulkImages } from "../controllers/products/delete-images-controller.js";

const router = express.Router();

/**
 * @route   DELETE /api/admin/images/:publicId
 * @desc    Delete single image from Cloudinary
 * @access  Private (Admin only)
 */
router.delete(
  "/images/:publicId",
  authMiddleware,
  roleMiddleware("admin"),
  deleteSingleImage
);

/**
 * @route   DELETE /api/admin/images/bulk
 * @desc    Delete multiple images from Cloudinary in bulk
 * @access  Private (Admin only)
 * @body    { publicIds: ["id1", "id2", "id3"] }
 */
router.delete(
  "/images/bulk",
  authMiddleware,
  roleMiddleware("admin"),
  deleteBulkImages
);

export default router;

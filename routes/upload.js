// routes/upload.js
import express from "express";
const router = express.Router();
import upload from "../middlewares/upload.js";
import uploadMiddleware from "../middlewares/uploadmiddlware.js";

/**
 * @route   POST /api/image/upload  (in local)
 * @desc    Upload a single image file
 * @access  Public (or protected if needed)
 */
router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const url = process.env.ImageBaseURl;

  res.status(200).json({
    message: "Image uploaded successfully",
    file: req.file.filename,
    path: `${url}/assets/${req.file.filename}`,
  });
});
/**
 * @route   POST /api/image/upload (Cloudinary)
 * @desc    Upload a single image file
 * @access  Public (or protected if needed)
 */
router.post("/upload-singel", uploadMiddleware("image"), (req, res) => {
  res.status(200).json({
    success: true,
    imageUrl: req.cloudinaryUrl,
  });
});
/**
 * @route   POST /api/image/upload-multiple
 * @desc    Upload multiple image files
 * @access  Public (or protected if needed)
 */
router.post(
  "/upload-multiple",
  uploadMiddleware("images", true),
  (req, res) => {
    res.status(200).json({
      success: true,
      imageUrls: req.cloudinaryUrls,
    });
  }
);

export default router; // ES Module style

// module.exports = router;

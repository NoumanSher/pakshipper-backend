// middleware/upload.js
// const multer = require('multer');
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AppName = process.env.AppName || "App"; // Default fallback
// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../assets")); // Save to 'assets' folder
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // e.g., '.png'
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9_-]/g, ""); // Optional: clean special characters
    const fileName = `${AppName}_${baseName}_${Date.now()}${ext}`;
    cb(null, fileName);
  },
});

// File filter (optional)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export default upload; // ES Module style

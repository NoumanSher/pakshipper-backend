import multer from 'multer';
import cloudinary from '../utils/cloudinary.js';
import { adminConfig } from '../utils/cloudinaryAdmin.js';
import { getCloudinaryConfig } from '../services/cloudinaryFactory.js';
import streamifier from 'streamifier';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinaryAdmin = (buffer, folder = 'ecommerce', cloudinaryConfig = null) => {
  return new Promise((resolve, reject) => {
    // Merge provided config with folder and presets
    const uploadOptions = {
      folder: folder,
      quality: 'auto',
      fetch_format: 'auto',
      ...(cloudinaryConfig || adminConfig) // Fallback to adminConfig from environment if no tenant config
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * uploadAdminMiddleware(fieldName, folder)
 * @param {string} fieldName - Name of the input field (e.g., 'images')
 * @param {string} folder - Cloudinary folder path (e.g., 'ecommerce/products')
 */
const uploadAdminMiddleware = (fieldName = 'images', folder = 'ecommerce') => {
  return [
    upload.array(fieldName),
    async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No files uploaded'
          });
        }

        // Get tenant-specific Cloudinary configuration
        const cloudinaryConfig = getCloudinaryConfig(req.tenantConfig, 'merchant');

        const uploadPromises = req.files.map((file) =>
          uploadToCloudinaryAdmin(file.buffer, folder, cloudinaryConfig)
        );
        const results = await Promise.all(uploadPromises);

        req.cloudinaryAdminUrls = results.map((r) => ({
          url: r.secure_url,
          publicId: r.public_id,
        }));

        next();
      } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Upload failed',
          error: err.message
        });
      }
    },
  ];
};

export default uploadAdminMiddleware;

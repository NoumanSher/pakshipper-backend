import multer from 'multer';
import cloudinary from '../utils/cloudinary.js';
import { getCloudinaryConfig } from '../services/cloudinaryFactory.js';
import streamifier from 'streamifier';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinary = (buffer, cloudinaryConfig = null) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'uploads',
      ...(cloudinaryConfig || {}) // Fallback to environment variables if no tenant config
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
 * uploadMiddleware(fieldName, isMultiple)
 * @param {string} fieldName - Name of the input field
 * @param {boolean} isMultiple - Whether to handle multiple files
 */
const uploadMiddleware = (fieldName, isMultiple = false) => {
  const handler = isMultiple ? upload.array(fieldName) : upload.single(fieldName);

  return [
    handler,
    async (req, res, next) => {
      try {
        const cloudinaryConfig = getCloudinaryConfig(req.tenantConfig, 'customer');

        if (isMultiple) {
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
          }

          const uploadPromises = req.files.map((file) => uploadToCloudinary(file.buffer, cloudinaryConfig));
          const results = await Promise.all(uploadPromises);
          req.cloudinaryUrls = results.map((r) => r.secure_url);
        } else {
          if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
          }

          const result = await uploadToCloudinary(req.file.buffer, cloudinaryConfig);
          req.cloudinaryUrl = result.secure_url;
        }

        next();
      } catch (err) {
        res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
      }
    },
  ];
};

export default uploadMiddleware;

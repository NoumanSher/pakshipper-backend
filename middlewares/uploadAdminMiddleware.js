import multer from 'multer';
import cloudinaryAdmin from '../utils/cloudinaryAdmin.js';
import streamifier from 'streamifier';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadToCloudinaryAdmin = (buffer, folder = 'ecommerce') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryAdmin.uploader.upload_stream(
      { 
        folder: folder,
        // Optional optimization parameters
        quality: 'auto',
        fetch_format: 'auto',
      },
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

        const uploadPromises = req.files.map((file) => 
          uploadToCloudinaryAdmin(file.buffer, folder)
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

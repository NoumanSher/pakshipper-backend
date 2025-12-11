// utils/cloudinaryAdmin.js
// Admin Cloudinary configuration for e-commerce store images (products, categories, etc.)
import { v2 as cloudinaryAdmin } from 'cloudinary';

cloudinaryAdmin.config({
  cloud_name: process.env.CLOUDINARY_ADMIN_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_ADMIN_API_KEY,
  api_secret: process.env.CLOUDINARY_ADMIN_API_SECRET,
});

export default cloudinaryAdmin;

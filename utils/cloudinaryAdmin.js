// Admin Cloudinary configuration for e-commerce store images (products, categories, etc.)
// We export the config object to be passed as options to the singleton instance methods
// because the v2 SDK is a singleton and we can't have two global configs active at once.

import dotenv from 'dotenv';
dotenv.config();

export const adminConfig = {
    cloud_name: process.env.CLOUDINARY_ADMIN_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_ADMIN_API_KEY,
    api_secret: process.env.CLOUDINARY_ADMIN_API_SECRET,
};


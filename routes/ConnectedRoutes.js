// Route Imports
import userRoutes from "./user-routes.js"; // User authentication and profile routes
import settingsRoutes from "./settings-routes.js"; // Application settings routes
import categoriesRoutes from "./categories-routes.js"; // Product categories routes
import productsRoutes from "./products-routes.js"; // Product management routes
import cartRoutes from "./user-cart-routes.js"; // User shopping cart routes
import orderRoutes from "./post-order-routes.js"; // Order placement and management routes
import reviewRoutes from "./review-routes.js"; // Product review routes
import uploadRoutes from "./upload.js"; // Image upload routes
import adminUploadRoutes from "./admin-upload-routes.js"; // Admin e-commerce image upload routes
import deleteImagesRoutes from "./delete-images-routes.js"; // Image deletion routes
// phase-2
/**
 * Connect all application routes to the Express app.
 *
 * @param {import('express').Express} app - The Express application instance
 */

const connectedRoutes = (app) => {
  // Test route
  app.use("/api/auth", userRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/order", orderRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/image", uploadRoutes); // Image uploads (client reviews)
  app.use("/api/admin", adminUploadRoutes); // Admin image uploads (e-commerce store)
  app.use("/api/admin", deleteImagesRoutes); // Image deletion routes
};

export default connectedRoutes;

import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  // getAllProductss,
  getLimitedProducts,
  getProductById,
  getProductBySlug,
  getProductsByCategoryPriority,
  updateProduct,
} from "../controllers/products/products-controller.js";
import {
  approveProduct,
  rejectProduct,
  resubmitProduct,
  getPendingProducts,
  getApprovalHistory,
  autoApproveExistingProducts,
} from "../controllers/products/approval-controller.js";

// import products from "../models/products.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";
import checkOwnershipOrPermission from "../middlewares/checkOwnershipOrPermission.js";
import checkResubmitPermission from "../middlewares/checkResubmitPermission.js";

const router = express.Router();

/**
 * @route   POST /api/products/create-product
 * @desc    Create a new product
 * @access  Admin
 */
router.post("/create-product", authMiddleware, checkPermission("write:products"), createProduct);

/**
 * @route   GET /api/products/get-product/:id
 * @desc    Get a single product by its ID
 * @access  Public
 */
router.get("/get-product/:id", authMiddleware, checkPermission("read:products"), getProductById);

/**
 * @route   GET /api/products/get-product-by-slug/:slug
 * @desc    Get a single product by its SEO slug
 * @access  Public
 */
router.get("/get-product-by-slug/:slug", getProductBySlug);

/**
 * @route   DELETE /api/products/delete-product/:id
 * @desc    Delete a product by ID
 * @access  Admin
 */

router.delete("/delete-product/:id", authMiddleware, checkOwnershipOrPermission("products", "delete"), deleteProduct);


/**
 * @route   GET /api/products/get-products-by-category-priority
 * @desc    Get products by category with priority ordering
 * @access  Public
 */
router.get("/get-products-by-category-priority", getProductsByCategoryPriority);

/**
 * @route   GET /api/products/get-all-products
 * @desc    Get all products
 * @access  Public
 */
router.get("/get-all-products", getAllProducts);
/**
 * @route   GET /api/products/get-all-products/searchquery
 * @desc    Get all products
 * @access  Public
 */
// router.get("/getall-products", getAllProductss);

/**
 * @route   PUT /api/products/update-product/:id
 * @desc    Update a product by its ID
 * @access  Admin
 */
router.put("/update-product/:id", authMiddleware, checkOwnershipOrPermission("products", "update"), updateProduct);

/**
 * @route   GET /api/products/get-limited-products
 * @desc    Get a limited set of products (pagination or featured)
 * @access  Public
 */
router.get("/get-limited-products", getLimitedProducts);

// =============================================
// PRODUCT APPROVAL ROUTES
// =============================================

/**
 * @route   GET /api/products/pending
 * @desc    Get all pending products for approval
 * @access  Admin or users with product_approval permission
 */
router.get("/pending", authMiddleware, checkPermission("product_approval"), getPendingProducts);

/**
 * @route   PATCH /api/products/:id/approve
 * @desc    Approve a product
 * @access  Admin or users with product_approval permission
 */
router.patch("/:id/approve", authMiddleware, checkPermission("product_approval"), approveProduct);

/**
 * @route   PATCH /api/products/:id/reject
 * @desc    Reject a product with reason
 * @access  Admin or users with product_approval permission
 */
router.patch("/:id/reject", authMiddleware, checkPermission("product_approval"), rejectProduct);

/**
 * @route   PATCH /api/products/:id/resubmit
 * @desc    Resubmit a rejected product for approval
 * @access  Product owner or admin
 */
router.patch("/:id/resubmit", authMiddleware, checkResubmitPermission, resubmitProduct);

/**
 * @route   GET /api/products/:id/approval-history
 * @desc    Get approval history for a product
 * @access  Admin or product owner
 */
router.get("/:id/approval-history", authMiddleware, checkOwnershipOrPermission("products", "read"), getApprovalHistory);

/**
 * @route   POST /api/products/migrate/approve-existing
 * @desc    Auto-approve all existing products (run once for migration)
 * @access  Admin only
 */
router.post("/migrate/approve-existing", authMiddleware, checkPermission("product_approval"), autoApproveExistingProducts);

export default router;

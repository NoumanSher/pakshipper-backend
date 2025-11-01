import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getAllProductss,
  getLimitedProducts,
  getProductById,
  getProductsByCategoryPriority,
  updateProduct,
} from "../controllers/products/products-controller.js";

const router = express.Router();

/**
 * @route   POST /api/products/create-product
 * @desc    Create a new product
 * @access  Admin
 */
router.post("/create-product", createProduct);

/**
 * @route   GET /api/products/get-product/:id
 * @desc    Get a single product by its ID
 * @access  Public
 */
router.get("/get-product/:id", getProductById);

/**
 * @route   DELETE /api/products/delete-product/:id
 * @desc    Delete a product by ID
 * @access  Admin
 */

router.delete("/delete-product/:id", deleteProduct);
 

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
router.get("/getall-products", getAllProductss); 

/**
 * @route   PUT /api/products/update-product/:id
 * @desc    Update a product by its ID
 * @access  Admin
 */
router.put("/update-product/:id", updateProduct);

/**
 * @route   GET /api/products/get-limited-products
 * @desc    Get a limited set of products (pagination or featured)
 * @access  Public
 */
router.get("/get-limited-products", getLimitedProducts);

export default router;

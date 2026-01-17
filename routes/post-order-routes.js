import express from "express";
import {
  AllOrders,
  bulkDeletePostOrders,
  createPostOrder,
  deletePostOrder,
  orderStatusUpdate,
  searchOrderNoOrders,
  userAddress,
  userAllOrders,
} from "../controllers/post-order/post-order.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";

const router = express.Router();

/**
 * @route   POST /api/order/create-order
 * @desc    Create a new order
 * @access  Authenticated User
 */
router.post("/create-order", createPostOrder);

/**
 * @route   GET /api/order/user-all-orders/:userId
 * @desc    Get all orders for a specific user
 * @access  Authenticated User
 */
router.get("/user-all-orders/:userId", userAllOrders);

/**
 * @route   GET /api/order/user-single-order/:orderNo
 * @desc    Get a single order by order number
 * @access  Authenticated User
 */
router.get("/user-single-order/:orderNo", searchOrderNoOrders);

/**
 * @route   GET /api/order/userAdress/:userId
 * @desc    Get the address of a specific user
 * @access  Authenticated User
 */
router.get("/userAdress/:userId", userAddress);

/**
 * @route   GET /api/order/all-orders
 * @desc    Get all orders (admin)
 * @access  Admin
 */
router.get("/all-orders", AllOrders);

/**
 * @route   PUT /api/order/update-status
 * @desc    Update order status (admin)
 * @access  Admin
 */
router.put("/update-status", orderStatusUpdate);

/**
 * @route   DELETE /api/order/delete-order/:id
 * @desc    Delete a single order (admin)
 * @access  Admin
 */
router.delete("/delete-order/:id", authMiddleware, checkPermission("manage:orders"), deletePostOrder);

/**
 * @route   DELETE /api/order/bulk-delete
 * @desc    Bulk delete orders (admin)
 * @access  Admin
 */
router.delete("/bulk-delete", authMiddleware, checkPermission("manage:orders"), bulkDeletePostOrders);

export default router;

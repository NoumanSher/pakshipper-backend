import express from "express";
import {
  AllOrders,
  createPostOrder,
  orderStatusUpdate,
  searchOrderNoOrders,
  userAddress,
  userAllOrders,
} from "../controllers/post-order/post-order.js";
import { stripeWebhook } from "../controllers/stripe/stripeController.js";

const router = express.Router();

/**
 * @route   POST /api/order/create-order
 * @desc    Create a new order
 * @access  Authenticated User
 */
router.post("/create-order", createPostOrder);
// Stripe requires the raw body to validate the signature
// Apply this ONLY to the webhook route
// router.post(
//   "/webhook/stripe",
//   express.raw({ type: "application/json" }), // Needed to verify signature
//   stripeWebhook
// );

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

export default router;

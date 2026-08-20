import express from "express";
import {
  adminAllReview,
  adminManualCreateReview,
  createReview,
  deleteReveiw,
  productReview,
  statusApprove,
  toggleHelpfulReview,
  userAllReveiw,
  userReviewEdit,
} from "../controllers/review/review-controllers.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";

const router = express.Router();

/**
 * @route POST /api/reviews/
 * @desc Create a new review
 * @access Authenticated user
 */
router.post("/", authMiddleware, createReview);

/**
 * @route POST /api/reviews/admin/manual-create
 * @desc Create a manual review seeded by admin (attributed to a user, with optional date)
 * @access Admin
 */
router.post(
  "/admin/manual-create",
  authMiddleware,
  checkPermission("reviews", "write"),
  adminManualCreateReview
);

/**
 * @route GET /api/reviews/product/:productId
 * @desc Get reviews for a specific product
 * @access Public
 */
router.get("/product/:productId", productReview);

/**
 * @route GET /api/reviews/admin/all
 * @desc Get all reviews (Admin only)
 * @access Admin
 */
router.get(
  "/admin/all",
  authMiddleware,
  checkPermission("reviews", "read"),
  adminAllReview
);

/**
 * @route PUT /api/reviews/admin/:reviewId/status
 * @desc Approve or reject a review (Admin only)
 * @access Admin
 */
router.put(
  "/admin/:reviewId/status",
  authMiddleware,
  checkPermission("reviews", "write"),
  statusApprove
);

/**
 * @route DELETE /api/reviews/admin/:reviewId
 * @desc Delete a review by admin
 * @access Admin
 */
router.delete(
  "/admin/:reviewId",
  authMiddleware,
  checkPermission("reviews", "delete"),
  deleteReveiw
);

/**
 * @route PUT /api/reviews/:reviewId
 * @desc Edit an existing review (User can edit their own review)
 * @access Authenticated user
 */
router.put("/:reviewId", authMiddleware, userReviewEdit);

/**
 * @route DELETE /api/reviews/:reviewId
 * @desc Delete a review
 * @access Authenticated user (or Admin)
 */
router.delete("/:reviewId", authMiddleware, deleteReveiw);

/**
 * @route GET /api/reviews/user/:userId
 * @desc Get all reviews by a specific user
 * @access Authenticated user
 */
router.get("/user/:userId", authMiddleware, userAllReveiw);

router.post("/review/helpful", authMiddleware, toggleHelpfulReview);

export default router;

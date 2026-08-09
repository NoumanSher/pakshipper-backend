import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import {
  subscribeNewsletter,
  getSubscribers,
  deleteSubscriber,
} from "../controllers/newsletterController.js";

const router = express.Router();

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Public subscription endpoint
 * @access  Public
 */
router.post("/subscribe", subscribeNewsletter);

/**
 * @route   GET /api/newsletter/subscribers
 * @desc    Get all newsletter subscribers
 * @access  Private/Admin
 */
router.get("/subscribers", authMiddleware, getSubscribers);

/**
 * @route   DELETE /api/newsletter/subscribers/:id
 * @desc    Remove a subscriber
 * @access  Private/Admin
 */
router.delete("/subscribers/:id", authMiddleware, deleteSubscriber);

export default router;

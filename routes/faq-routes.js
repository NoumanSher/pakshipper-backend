import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";
import { getAllFaqs } from "../controllers/faq/get-all-faqs.js";
import { createFaq } from "../controllers/faq/create-faq.js";
import { updateFaq } from "../controllers/faq/update-faq.js";
import { deleteFaq } from "../controllers/faq/delete-faq.js";

const router = express.Router();

/**
 * @route   GET /api/faqs
 * @desc    Get all FAQs (public active only, admin/merchant panel all)
 * @access  Public
 */
router.get("/", getAllFaqs);

/**
 * @route   POST /api/faqs
 * @desc    Create a new FAQ
 * @access  Private/Admin
 */
router.post(
  "/",
  authMiddleware,
  checkPermission("settings", "write"),
  createFaq
);

/**
 * @route   PUT /api/faqs/:id
 * @desc    Update a FAQ by ID
 * @access  Private/Admin
 */
router.put(
  "/:id",
  authMiddleware,
  checkPermission("settings", "write"),
  updateFaq
);

/**
 * @route   DELETE /api/faqs/:id
 * @desc    Delete a FAQ by ID
 * @access  Private/Admin
 */
router.delete(
  "/:id",
  authMiddleware,
  checkPermission("settings", "write"),
  deleteFaq
);

export default router;

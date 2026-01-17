import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";
import { getSettings } from "../controllers/settiing/get-seetings.js";
import { createOrUpdateSettings } from "../controllers/settiing/create-setting.js";
import { updateSettings } from "../controllers/settiing/update-settings.js";
import { deleteSettings } from "../controllers/settiing/delete-settings.js";

const router = express.Router();

/**
 * @route   GET /api/settings
 * @desc    Get all settings
 * @access  Public
 */
router.get("/", getSettings);

/**
 * @route   POST /api/settings/create
 * @desc    Create or update settings
 * @access  Private/Admin
 */
router.post(
  "/create",
  authMiddleware,
  checkPermission("manage:settings"),
  createOrUpdateSettings
);

/**
 * @route   PUT /api/settings/update
 * @desc    Update settings
 * @access  Private/Admin
 */
router.put(
  "/update",
  authMiddleware,
  checkPermission("manage:settings"),
  updateSettings
);

/**
 * @route   DELETE /api/settings
 * @desc    Delete all settings
 * @access  Public (⚠️ Consider restricting to Admin)
 */
router.delete("/", deleteSettings);

export default router;

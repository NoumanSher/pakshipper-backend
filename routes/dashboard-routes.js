import express from "express";
import { getDashboardStats } from "../controllers/dashboard/dashboard-controllers.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";

const router = express.Router();

// Admin only dashboard route
router.get("/", authMiddleware, checkPermission("analytics", "read"), getDashboardStats);

export default router;

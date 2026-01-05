import express from "express";
import { getDashboardStats } from "../controllers/dashboard/dashboard-controllers.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import roleMiddleware from "../middlewares/roleMiddleWare.js";

const router = express.Router();

// Admin only dashboard route
router.get("/", authMiddleware, roleMiddleware("admin"), getDashboardStats);

export default router;

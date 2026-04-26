import express from "express";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notification/notificationController.js";
import authMiddleware from "../middlewares/authMiddleWare.js";

const router = express.Router();

router.use(authMiddleware); // All notification routes require authentication

router.get("/", getUserNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

export default router;

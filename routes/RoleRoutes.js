import express from "express";
import {
    createRole,
    getRoles,
    updateRole,
    deleteRole,
} from "../controllers/role-controllers.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";

const router = express.Router();

// Role management routes
router.get("/", authMiddleware, checkPermission("roles", "read"), getRoles);
router.post("/create", authMiddleware, checkPermission("roles", "write"), createRole);
router.put("/update/:id", authMiddleware, checkPermission("roles", "write"), updateRole);
router.delete("/delete/:id", authMiddleware, checkPermission("roles", "write"), deleteRole);

export default router;

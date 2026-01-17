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

// Role management routes (Admin only)
router.use(authMiddleware, checkPermission("manage:roles"));

router.post("/create", createRole);
router.get("/", getRoles);
router.put("/update/:id", updateRole);
router.delete("/delete/:id", deleteRole);

export default router;

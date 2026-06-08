import express from "express";
import {
  loginPlatformAdmin,
  refreshPlatformToken,
  getPlatformMe
} from "../../controllers/platform/platformAuthController.js";
import platformAuth from "../../middlewares/platformAuth.js";

const router = express.Router();

router.post("/login", loginPlatformAdmin);
router.post("/refresh-token", refreshPlatformToken);
router.get("/me", platformAuth, getPlatformMe);

export default router;

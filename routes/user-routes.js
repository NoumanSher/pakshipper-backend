import express from "express";
import { registerUser } from "../controllers/authentication/register-user.js";
import { loginUser } from "../controllers/authentication/login-user.js";
import { getUserById } from "../controllers/authentication/get-user-by-id.js";
import { updateUser } from "../controllers/authentication/update-user.js";
import { resetPassword } from "../controllers/authentication/reset-password.js";
import { forgetPassword } from "../controllers/authentication/forget-password.js";
import { getAllUsers } from "../controllers/authentication/get-all-user.js";
import { getMe } from "../controllers/authentication/get-me.js";
import authMiddleware from "../middlewares/authMiddleWare.js";
import roleMiddleware from "../middlewares/roleMiddleWare.js";
import passport from "../OAuth/Google/googleStrategy.js";
// Ensure LinkedIn strategy is registered (side-effect import)
import "../OAuth/LinkedIn/LinkdinStaregy.js";
// import passportL from "../OAuth/LinkedIn/LinkdinStaregy.js";

const router = express.Router();

/**
 * @route   POST /api/auth/register-user
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register-user", registerUser);

/**
 * @route   POST /api/auth/login-user
 * @desc    Login user and return token
 * @access  Public
 */
router.post("/login-user", loginUser);

/**
 * @route   GET /api/auth/user-data/:id
 * @desc    Get user data by ID
 * @access  Private
 */
router.get("/user-data/:id", authMiddleware, getUserById);

/**
 * @route   PUT /api/auth/update-user/:id
 * @desc    Update user details
 * @access  Private
 */
router.put("/update-user/:id", authMiddleware, updateUser);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password for authenticated user
 * @access  Private
 */
router.post("/reset-password", authMiddleware, resetPassword);

/**
 * @route   POST /api/auth/forget-password
 * @desc    Send password reset link
 * @access  Private (should be public in many systems, adjust as needed)
 */
router.post("/forget-password", authMiddleware, forgetPassword);

/**
 * @route   GET /api/auth/all
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
router.get("/all", authMiddleware, roleMiddleware("admin"), getAllUsers);

// Get current authenticated user via token (JWT)
router.get("/me", authMiddleware, getMe);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/linkedin",
  passport.authenticate("linkedin", {
    scope: ["openid", "profile", "email"],
  })
);

router.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", {
    failureRedirect: "/login",
    session: false,
  }),
  function (req, res) {
    console.log('[LinkedIn callback] req.user =>', req.user);
    const { user, token } = req.user || {};
    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error`);
    }
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/auth/success#token=${token}`);
  }
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  function (req, res) {
    console.log("[OAuth callback] req.user =>", req.user);
    const { user, token } = req.user || {};
    if (!token) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/error`
      );
    }
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/auth/success#token=${token}`);
  }
);


export default router;

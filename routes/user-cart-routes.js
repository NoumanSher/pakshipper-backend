import express from "express";
import { createUserCart } from "../controllers/cart/create-user-cart.js";
import { userCartItems } from "../controllers/cart/single-user-cart.js";
import { updateCartQuantity } from "../controllers/cart/update-user-cart.js";
import { deleteCartItem } from "../controllers/cart/delete-user-cart.js";

const router = express.Router();

/**
 * @route   POST /api/cart/create-user-cart
 * @desc    Add a new item to the user's cart
 * @access  Authenticated User
 */
router.post("/create-user-cart", createUserCart);

/**
 * @route   GET /api/cart/single-user-cart/:userId
 * @desc    Get all items in a single user's cart
 * @access  Authenticated User
 */
router.get("/single-user-cart/:userId", userCartItems);

/**
 * @route   PUT /api/cart/update-user-cart
 * @desc    Update quantity of an item in the user's cart
 * @access  Authenticated User
 */
router.put("/update-user-cart", updateCartQuantity);

/**
 * @route   DELETE /api/cart/delete-user-cart
 * @desc    Delete an item from the user's cart
 * @access  Authenticated User
 */
router.delete("/delete-user-cart", deleteCartItem);

export default router;

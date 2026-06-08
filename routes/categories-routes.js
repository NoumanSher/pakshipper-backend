import express from "express";
import authMiddleware from "../middlewares/authMiddleWare.js";
import checkPermission from "../middlewares/permissionMiddleWare.js";

import {
    getChildCategoryById,
    getChildCategoryBySlug,
    getParentCategoryById,
    getParentCategoryBySlug,
} from "../controllers/categories/categories.js";

import { getParentCategoriesWithChildren } from "../controllers/categories/get-all-categories/get-all-categories.js";
import { getAllParentCategories } from "../controllers/categories/get-all-categories/get-all-parent-categories.js";
import { getAllChildCategories } from "../controllers/categories/get-all-categories/get-all-child-categories.js";
import { getChildCategoriesByParentId } from "../controllers/categories/get-all-categories/get-child-categories-by-parentId.js";

import { createParentCategory } from "../controllers/categories/create-categories/create-parent-category.js";
import { createChildCategory } from "../controllers/categories/create-categories/create-child-category.js";

import { updateParentCategory } from "../controllers/categories/update-categories/update-parent-category.js";
import { updateChildCategory } from "../controllers/categories/update-categories/update-child-category.js";

import { deleteParentCategory } from "../controllers/categories/delete-categories/delete-parent-category.js";
import { deleteChildCategory } from "../controllers/categories/delete-categories/delete-child-category.js";

const router = express.Router();

/**
 * @route   GET /api/categories/all
 * @desc    Get all parent categories with their child categories
 * @access  Public
 */
router.get("/all", getParentCategoriesWithChildren);

/**
 * @route   POST /api/categories/create-parent-category
 * @desc    Create a new parent category
 * @access  Admin
 */
router.post("/create-parent-category", authMiddleware, checkPermission("categories", "write"), createParentCategory);

/**
 * @route   POST /api/categories/create-child-category
 * @desc    Create a new child category
 * @access  Admin
 */
router.post("/create-child-category", authMiddleware, checkPermission("categories", "write"), createChildCategory);

/**
 * @route   GET /api/categories/all-parent
 * @desc    Get all parent categories
 * @access  Public
 */
router.get("/all-parent", getAllParentCategories);

/**
 * @route   GET /api/categories/all-child
 * @desc    Get all child categories
 * @access  Public
 */
router.get("/all-child", getAllChildCategories);

/**
 * @route   GET /api/categories/parent/:id
 * @desc    Get a parent category by its ID
 * @access  Public
 */
router.get("/parent/:id", getParentCategoryById);

/**
 * @route   GET /api/categories/child/:id
 * @desc    Get a child category by its ID
 * @access  Public
 */
router.get("/child/:id", getChildCategoryById);

/**
 * @route   GET /api/categories/parent/slug/:slug
 * @desc    Get a parent category by its slug
 * @access  Public
 */
router.get("/parent/slug/:slug", getParentCategoryBySlug);

/**
 * @route   GET /api/categories/child/slug/:slug
 * @desc    Get a child category by its slug
 * @access  Public
 */
router.get("/child/slug/:slug", getChildCategoryBySlug);

/**
 * @route   PUT /api/categories/update-parent-category/:id
 * @desc    Update a parent category
 * @access  Admin
 */
router.put("/update-parent-category/:id", authMiddleware, checkPermission("categories", "write"), updateParentCategory);

/**
 * @route   DELETE /api/categories/delete-parent-category/:id
 * @desc    Delete a parent category
 * @access  Admin
 */
router.delete("/delete-parent-category/:id", authMiddleware, checkPermission("categories", "delete"), deleteParentCategory);

/**
 * @route   GET /api/categories/parent/:id/children
 * @desc    Get all child categories for a specific parent category
 * @access  Public
 */
router.get("/parent/:id/children", getChildCategoriesByParentId);

/**
 * @route   PUT /api/categories/update-child-category/:id
 * @desc    Update a child category
 * @access  Admin
 */
router.put("/update-child-category/:id", authMiddleware, checkPermission("categories", "write"), updateChildCategory);

/**
 * @route   DELETE /api/categories/delete-child-category/:id
 * @desc    Delete a child category
 * @access  Admin
 */
router.delete("/delete-child-category/:id", authMiddleware, checkPermission("categories", "delete"), deleteChildCategory);

export default router;

import CategoryService from "../../services/categoryService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/categories/parent/:id
 * @desc    Get a single parent category by its ID
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the parent category or error
 */
export const getParentCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await CategoryService.getParentCategory(req.models, id);
  res.status(200).json({ message: "Category found", category });
});

/**
 * @route   GET /api/categories/child/:id
 * @desc    Get a single child category by its ID
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the child category or error
 */
export const getChildCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await CategoryService.getChildCategory(req.models, id);
  res.status(200).json({ message: "Category found", category });
});

/**
 * @route   GET /api/categories/parent/slug/:slug
 * @desc    Get a single parent category by its slug
 * @access  Public
 */
export const getParentCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const category = await CategoryService.getParentCategory(req.models, slug);
  res.status(200).json({ message: "Category found", category });
});

/**
 * @route   GET /api/categories/child/slug/:slug
 * @desc    Get a single child category by its slug
 * @access  Public
 */
export const getChildCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const category = await CategoryService.getChildCategory(req.models, slug);
  res.status(200).json({ message: "Category found", category });
});


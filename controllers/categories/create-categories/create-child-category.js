import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";
import { z } from "zod";

const childCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  parentCategory: z.string().min(1),
});

/**
 * @route   POST /api/categories/create-child-category
 * @desc    Create a new child category under a parent category
 * @access  Admin (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} req.body - Contains name, slug, description, and parentCategory ID
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with created child category or error message
 */
export const createChildCategory = asyncHandler(async (req, res) => {
  const validatedData = childCategorySchema.parse(req.body);
  const childCategory = await CategoryService.createChildCategory(validatedData);

  res.status(201).json({
    message: "Child Category created successfully",
    category: childCategory,
  });
});

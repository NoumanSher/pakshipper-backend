import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";
import { z } from "zod";

const parentCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  recommendedCategories: z.array(z.string()).optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @route   POST /api/categories/create-parent-category
 * @desc    Create a new parent category
 * @access  Admin (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} req.body - Contains name, slug, description, image, sortOrder, isActive
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with created category or error message
 */
export const createParentCategory = asyncHandler(async (req, res) => {
  const validatedData = parentCategorySchema.parse(req.body);
  const newCategory = await CategoryService.createParentCategory(req.models, req.tenantConfig.tenantId, validatedData);

  res.status(201).json({
    message: "Parent Category created successfully",
    category: newCategory,
  });
});

import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";
import { z } from "zod";

const updateParentCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  recommendedCategories: z.array(z.string()).optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @route   PUT /api/categories/parent/:id
 * @desc    Update a parent category by ID
 * @access  Public or Protected (depending on middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the updated category or error
 */
export const updateParentCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = updateParentCategorySchema.parse(req.body);
  const updatedCategory = await CategoryService.updateParentCategory(req.models, req.tenantConfig.tenantId, id, validatedData);

  res.status(200).json({
    message: "Category updated successfully",
    category: updatedCategory,
  });
});

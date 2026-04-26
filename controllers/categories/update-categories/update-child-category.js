import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";
import { z } from "zod";

const updateChildCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  parentCategory: z.string().min(1).optional(),
});

/**
 * @route   PUT /api/categories/child/:id
 * @desc    Update a child category by ID
 * @access  Admin (or as required)
 */
export const updateChildCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = updateChildCategorySchema.parse(req.body);
  const updatedCategory = await CategoryService.updateChildCategory(id, validatedData);

  res.status(200).json({
    message: "Category updated successfully",
    category: updatedCategory,
  });
});

import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/categories/parent/:id/children
 * @desc    Fetch all child categories of a specific parent category
 * @access  Public or Protected (based on middleware)
 */
export const getChildCategoriesByParentId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { parentCategory, childCategories } = await CategoryService.getChildCategoriesByParentId(id);

  res.status(200).json({
    message: "Successfully fetched child categories of the parent",
    parentCategory,
    childCategories,
  });
});

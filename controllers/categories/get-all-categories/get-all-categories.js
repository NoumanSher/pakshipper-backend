import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/categories/all
 * @desc    Fetch all parent categories along with their child categories using aggregation
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON containing parent categories with nested child categories
 */
export const getParentCategoriesWithChildren = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getParentCategoriesWithChildren(req.models);

  res.status(200).json({
    message: "Successfully fetched parent categories with children",
    categories
  });
});

import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/categories/all-parent-categories
 * @desc    Get all parent categories sorted by creation date (latest first)
 * @access  Public (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with a list of parent categories or error
 */
export const getAllParentCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getAllParentCategories(req.models);

  res.status(200).json({
    message: "Successfully Fetched!",
    categories
  });
});

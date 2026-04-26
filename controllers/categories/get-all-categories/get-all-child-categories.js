import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/categories/all-child-categories
 * @desc    Retrieve all child categories sorted by creation date (newest first)
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with list of child categories or error
 */
export const getAllChildCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getAllChildCategories();

  res.status(200).json({
    message: "Successfully Fetched!",
    categories
  });
});

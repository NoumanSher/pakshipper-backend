import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   DELETE /api/categories/parent/:id
 * @desc    Delete a parent category by ID
 * @access  Public or Protected (depending on middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const deleteParentCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await CategoryService.deleteParentCategory(id);
  res.status(200).json({ message: "Category deleted successfully" });
});

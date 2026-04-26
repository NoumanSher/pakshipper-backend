import CategoryService from "../../../services/categoryService.js";
import asyncHandler from "../../../middlewares/asyncHandler.js";

/**
 * @route   DELETE /api/categories/child/:id
 * @desc    Delete a child category by ID
 * @access  Admin (or as needed)
 */
export const deleteChildCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await CategoryService.deleteChildCategory(id);
  res.status(200).json({ message: "Child category deleted successfully" });
});

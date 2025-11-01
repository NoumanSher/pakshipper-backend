import ParentCategories from "../../../models/categories.js";

/**
 * @route   DELETE /api/categories/parent/:id
 * @desc    Delete a parent category by ID
 * @access  Public or Protected (depending on middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const deleteParentCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Attempt to delete the category
    const deletedCategory = await ParentCategories.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting Category", error: error.message });
  }
};

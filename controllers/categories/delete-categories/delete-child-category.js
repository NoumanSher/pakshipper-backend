import ChildCategories from "../../../models/child-categories.js";

/**
 * @route   DELETE /api/categories/child/:id
 * @desc    Delete a child category by ID
 * @access  Admin (or as needed)
 */
export const deleteChildCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCategory = await ChildCategories.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Child category not found" });
    }

    res.status(200).json({ message: "Child category deleted successfully" });
  } catch (error) {
    console.error("Error deleting child category:", error);
    res.status(500).json({ message: "Error deleting child category", error: error.message });
  }
};

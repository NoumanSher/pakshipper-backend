import ChildCategories from "../../../models/child-categories.js";

/**
 * @route   PUT /api/categories/child/:id
 * @desc    Update a child category by ID
 * @access  Admin (or as required)
 */
export const updateChildCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body;

    // Check if another category with the same slug exists
    const existingCategory = await ChildCategories.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).json({ message: "Slug already in use by another category" });
    }

    const updatedCategory = await ChildCategories.findByIdAndUpdate(
      id,
      { name, slug, description },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Child category not found" });
    }

    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating category", error: error.message });
  }
};

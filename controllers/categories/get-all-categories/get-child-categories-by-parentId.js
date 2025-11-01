import ParentCategories from "../../../models/categories.js";
import ChildCategories from "../../../models/child-categories.js";

/**
 * @route   GET /api/categories/parent/:id/children
 * @desc    Fetch all child categories of a specific parent category
 * @access  Public or Protected (based on middleware)
 */
export const getChildCategoriesByParentId = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the parent category ID
    const parentCategory = await ParentCategories.findById(id).lean();
    if (!parentCategory) {
      return res.status(404).json({ message: "Parent category not found" });
    }

    // Fetch child categories linked to the parent
    const childCategories = await ChildCategories.find({ parentCategory: id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      message: "Successfully fetched child categories of the parent",
      parentCategory,
      childCategories,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching child categories",
      error: error.message,
    });
  }
};

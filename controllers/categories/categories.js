import ParentCategories from "../../models/categories.js";
import ChildCategories from "../../models/child-categories.js";

/**
 * @route   GET /api/categories/parent/:id
 * @desc    Get a single parent category by its ID
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the parent category or error
 */
export const getParentCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ParentCategories.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(200).json({ message: "Category found", category });
  } catch (error) {
    res.status(500).json({ message: "Error getting Category", error });
  }
};

/**
 * @route   GET /api/categories/child/:id
 * @desc    Get a single child category by its ID
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the child category or error
 */
export const getChildCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ChildCategories.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.status(200).json({ message: "Category found", category });
  } catch (error) {
    res.status(500).json({ message: "Error getting Category", error });
  }
};

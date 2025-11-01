import ParentCategories from "../../../models/categories.js";

/**
 * @route   POST /api/categories/create-parent-category
 * @desc    Create a new parent category
 * @access  Admin (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} req.body - Contains name, slug, and optional description
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with created category or error message
 */
export const createParentCategory = async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({ message: "Name and Slug are required" });
    }

    // Check if a category with the same slug already exists
    const existingCategory = await ParentCategories.findOne({ slug });
    if (existingCategory) {
      return res.status(400).json({ message: "Slug already exists" });
    }

    // Create and save the new parent category
    const newCategory = new ParentCategories({ name, slug, description });
    await newCategory.save();

    res.status(201).json({
      message: "Parent Category created successfully",
      category: newCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating Category", error });
  }
};

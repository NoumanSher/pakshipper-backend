import ChildCategories from "../../../models/child-categories.js";

/**
 * @route   POST /api/categories/create-child-category
 * @desc    Create a new child category under a parent category
 * @access  Admin (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} req.body - Contains name, slug, description, and parentCategory ID
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with created child category or error message
 */
export const createChildCategory = async (req, res) => {
  try {
    const { name, slug, description, parentCategory } = req.body;

    // Validate required fields
    if (!name || !slug || !parentCategory) {
      return res
        .status(400)
        .json({ message: "Name, Slug, and Parent Category are required" });
    }

    // Create and save the child category
    const childCategory = new ChildCategories({
      name,
      slug,
      description,
      parentCategory,
    });
    await childCategory.save();

    res
      .status(201)
      .json({
        message: "Child Category created successfully",
        category: childCategory,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating Category", error });
  }
};

import ParentCategories from "../../../models/categories.js";

/**
 * @route   GET /api/categories/all-parent-categories
 * @desc    Get all parent categories sorted by creation date (latest first)
 * @access  Public (or as per middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with a list of parent categories or error
 */
export const getAllParentCategories = async (req, res) => {
  try {
    const categories = await ParentCategories.find().sort({ createdAt: 1 });

    res.status(200).json({
      message: "Successfully Fetched!",
      categories: categories
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Category", error });
  }
};

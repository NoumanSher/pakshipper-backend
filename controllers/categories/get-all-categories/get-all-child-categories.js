import ChildCategories from "../../../models/child-categories.js";

/**
 * @route   GET /api/categories/all-child-categories
 * @desc    Retrieve all child categories sorted by creation date (newest first)
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with list of child categories or error
 */
export const getAllChildCategories = async (req, res) => {
  try {
    const categories = await ChildCategories.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Successfully Fetched!",
      categories: categories
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Category", error });
  }
};

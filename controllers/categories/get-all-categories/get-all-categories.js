import ParentCategories from "../../../models/categories.js";

/**
 * @route   GET /api/categories/all
 * @desc    Fetch all parent categories along with their child categories using aggregation
 * @access  Public
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON containing parent categories with nested child categories
 */
export const getParentCategoriesWithChildren = async (req, res) => {
  try {
    const categories = await ParentCategories.aggregate([
      // Sort parent categories by creation date (newest first)
      {
        $sort: { createdAt: -1 }
      },
      // Lookup corresponding child categories
      {
        $lookup: {
          from: "childcategories", // Collection name in MongoDB
          localField: "_id",       // Parent category ID
          foreignField: "parentCategory", // Child's reference to parent
          as: "children"           // Output array field
        }
      },
      // Sort children by their createdAt timestamp (descending)
      {
        $addFields: {
          children: {
            $sortArray: {
              input: "$children",
              sortBy: { createdAt: -1 }
            }
          }
        }
      }
    ]);

    res.status(200).json({
      message: "Successfully fetched parent categories with children",
      categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Error fetching categories", error });
  }
};

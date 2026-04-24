import ParentCategories from "../../../models/categories.js";
import client from "../../../config/redis/redisClient.js";

/**
 * @route   PUT /api/categories/parent/:id
 * @desc    Update a parent category by ID
 * @access  Public or Protected (depending on middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with the updated category or error
 */
export const updateParentCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, recommendedCategories } = req.body;

    // Check for existing category with the same slug (excluding the current one)
    const existingCategory = await ParentCategories.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).json({ message: "Category already exists" });
    }

    // Update the category
    const updatedCategory = await ParentCategories.findByIdAndUpdate(
      id,
      { name, slug, description, recommendedCategories },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // 🧹 Flush Redis cache
    try {
      await client.flushAll();
      console.log("✅ Redis cache flushed after parent category update");
    } catch (cacheError) {
      console.error("⚠️ Error flushing Redis cache:", cacheError.message);
    }

    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating Category", error });
  }
};

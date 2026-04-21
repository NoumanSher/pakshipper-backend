import ChildCategories from "../../../models/child-categories.js";
import Product from "../../../models/products.js";
import client from "../../../config/redis/redisClient.js";

/**
 * @route   DELETE /api/categories/child/:id
 * @desc    Delete a child category by ID
 * @access  Admin (or as needed)
 */
export const deleteChildCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if there are any products linked to this child category
    const linkedProductsCount = await Product.countDocuments({ childCategoryID: id });
    if (linkedProductsCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete child category: It has linked products. Please reassign the products first." 
      });
    }

    const deletedCategory = await ChildCategories.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Child category not found" });
    }

    // 2. 🧹 Clear Redis cache
    try {
      await client.flushAll();
      console.log("✅ Redis cache flushed after child category deletion");
    } catch (cacheError) {
      console.error("⚠️ Error flushing Redis cache:", cacheError.message);
    }

    res.status(200).json({ message: "Child category deleted successfully" });
  } catch (error) {
    console.error("Error deleting child category:", error);
    res.status(500).json({ message: "Error deleting child category", error: error.message });
  }
};

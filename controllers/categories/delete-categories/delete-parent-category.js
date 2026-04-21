import ParentCategories from "../../../models/categories.js";
import ChildCategories from "../../../models/child-categories.js";
import Product from "../../../models/products.js";
import client from "../../../config/redis/redisClient.js";

/**
 * @route   DELETE /api/categories/parent/:id
 * @desc    Delete a parent category by ID
 * @access  Public or Protected (depending on middleware)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
export const deleteParentCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if there are any child categories linked to this parent
    const linkedChildCategoriesCount = await ChildCategories.countDocuments({ parentCategory: id });
    if (linkedChildCategoriesCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category: It has linked child categories. Please delete or reassign them first." 
      });
    }

    // 2. Check if there are any products linked to this parent category
    const linkedProductsCount = await Product.countDocuments({ parentCategoryID: id });
    if (linkedProductsCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category: It has linked products. Please reassign the products to another category first." 
      });
    }

    // Attempt to delete the category
    const deletedCategory = await ParentCategories.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // 3. 🧹 Clear Redis cache for products and categories
    try {
      await client.flushAll();
      console.log("✅ Redis cache flushed after category deletion");
    } catch (cacheError) {
      console.error("⚠️ Error flushing Redis cache:", cacheError.message);
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting Category", error: error.message });
  }
};

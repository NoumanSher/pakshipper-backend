import { flushTenantCache } from "../config/redis/redisHelpers.js";
import AppError from "../utils/AppError.js";

class CategoryService {
  /**
   * Create a parent category.
   */
  static async createParentCategory(models, tenantId, data) {
    const { ParentCategories } = models;
    const { name, slug, description, recommendedCategories } = data;

    const existingCategory = await ParentCategories.findOne({ slug });
    if (existingCategory) throw new AppError("Slug already exists", 400);

    const newCategory = new ParentCategories({ name, slug, description, recommendedCategories });
    await newCategory.save();
    await this._flushCache(tenantId);

    return newCategory;
  }

  /**
   * Create a child category.
   */
  static async createChildCategory(models, tenantId, data) {
    const { ChildCategories } = models;
    const { name, slug, description, parentCategory } = data;

    const childCategory = new ChildCategories({ name, slug, description, parentCategory });
    await childCategory.save();
    await this._flushCache(tenantId);

    return childCategory;
  }

  /**
   * Fetch a parent category by ID or slug.
   */
  static async getParentCategory(models, idOrSlug) {
    const { ParentCategories } = models;
    const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
    const category = await ParentCategories.findOne(query);
    if (!category) throw new AppError("Parent Category not found", 404);
    return category;
  }

  /**
   * Fetch a child category by ID or slug.
   */
  static async getChildCategory(models, idOrSlug) {
    const { ChildCategories } = models;
    const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/) ? { _id: idOrSlug } : { slug: idOrSlug };
    const category = await ChildCategories.findOne(query);
    if (!category) throw new AppError("Child Category not found", 404);
    return category;
  }

  /**
   * Fetch all parent categories.
   */
  static async getAllParentCategories(models) {
    const { ParentCategories } = models;
    return await ParentCategories.find().sort({ updatedAt: -1 });
  }

  /**
   * Fetch all child categories.
   */
  static async getAllChildCategories(models) {
    const { ChildCategories } = models;
    return await ChildCategories.find().populate("parentCategory", "name slug").sort({ updatedAt: -1 });
  }

  /**
   * Fetch child categories by parent ID.
   */
  static async getChildCategoriesByParentId(models, parentCategoryId) {
    const { ParentCategories, ChildCategories } = models;
    const parentCategory = await ParentCategories.findById(parentCategoryId).lean();
    if (!parentCategory) throw new AppError("Parent category not found", 404);

    const childCategories = await ChildCategories.find({ parentCategory: parentCategoryId })
      .sort({ updatedAt: -1 })
      .lean();

    return { parentCategory, childCategories };
  }

  /**
   * Fetch all parent categories with their child categories.
   */
  static async getParentCategoriesWithChildren(models) {
    const { ParentCategories } = models;
    return await ParentCategories.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "childcategories",
          localField: "_id",
          foreignField: "parentCategory",
          as: "children"
        }
      },
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
  }

  /**
   * Fetch all categories (Parent + Child).
   */
  static async getAllCategories(models) {
    const { ParentCategories, ChildCategories } = models;
    const [parents, children] = await Promise.all([
      ParentCategories.find().sort({ updatedAt: -1 }),
      ChildCategories.find().populate("parentCategory", "name slug").sort({ updatedAt: -1 })
    ]);
    return { parents, children };
  }

  /**
   * Update a parent category.
   */
  static async updateParentCategory(models, tenantId, id, data) {
    const { ParentCategories } = models;
    if (data.slug) {
      const existingCategory = await ParentCategories.findOne({ slug: data.slug });
      if (existingCategory && existingCategory._id.toString() !== id) {
        throw new AppError("Category with this slug already exists", 400);
      }
    }

    const updatedCategory = await ParentCategories.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updatedCategory) throw new AppError("Parent Category not found", 404);
    await this._flushCache(tenantId);
    return updatedCategory;
  }

  /**
   * Update a child category.
   */
  static async updateChildCategory(models, tenantId, id, data) {
    const { ChildCategories } = models;
    if (data.slug) {
      const existingCategory = await ChildCategories.findOne({ slug: data.slug });
      if (existingCategory && existingCategory._id.toString() !== id) {
        throw new AppError("Slug already in use by another category", 400);
      }
    }

    const updatedCategory = await ChildCategories.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updatedCategory) throw new AppError("Child Category not found", 404);
    await this._flushCache(tenantId);
    return updatedCategory;
  }

  /**
   * Delete a parent category and optionally its child categories.
   */
  static async deleteParentCategory(models, tenantId, id) {
    const { ParentCategories, ChildCategories, Product } = models;
    // 1. Check if there are any child categories linked to this parent
    const linkedChildCategoriesCount = await ChildCategories.countDocuments({ parentCategory: id });
    if (linkedChildCategoriesCount > 0) {
      throw new AppError("Cannot delete category: It has linked child categories. Please delete or reassign them first.", 400);
    }

    // 2. Check if there are any products linked to this parent category
    const linkedProductsCount = await Product.countDocuments({ parentCategoryID: id });
    if (linkedProductsCount > 0) {
      throw new AppError("Cannot delete category: It has linked products. Please reassign the products to another category first.", 400);
    }

    const deletedCategory = await ParentCategories.findByIdAndDelete(id);
    if (!deletedCategory) throw new AppError("Parent Category not found", 404);
    
    await this._flushCache(tenantId);
    return deletedCategory;
  }

  /**
   * Delete a child category.
   */
  static async deleteChildCategory(models, tenantId, id) {
    const { ChildCategories, Product } = models;
    // 1. Check if there are any products linked to this child category
    const linkedProductsCount = await Product.countDocuments({ childCategoryID: id });
    if (linkedProductsCount > 0) {
      throw new AppError("Cannot delete child category: It has linked products. Please reassign the products first.", 400);
    }

    const deletedCategory = await ChildCategories.findByIdAndDelete(id);
    if (!deletedCategory) throw new AppError("Child Category not found", 404);
    await this._flushCache(tenantId);
    return deletedCategory;
  }

  /**
   * Helper to flush cache for tenant.
   */
  static async _flushCache(tenantId) {
    if (!tenantId) return;
    try {
      await flushTenantCache(tenantId);
    } catch (error) {
      console.error("Redis flush error:", error);
    }
  }
}

export default CategoryService;

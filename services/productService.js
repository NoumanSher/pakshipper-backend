import Product from "../models/products.js";
import client from "../config/redis/redisClient.js";
import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import Review from "../models/Review.js";
import PostOrder from "../models/post-order.js";
import UserCart from "../models/UserCart.js";
import cloudinary from "../utils/cloudinary.js";
import { adminConfig } from "../utils/cloudinaryAdmin.js";
import ParentCategory from "../models/categories.js";
import ChildCategory from "../models/child-categories.js";

const commonProjection = {
  images: { $slice: 1 },
  costPrice: 0,
  description: 0,
  options: 0,
  __v: 0,
};

class ProductService {
  /**
   * Creates a new product in the database.
   * @param {Object} productData - The validated product data.
   * @param {String} userId - The ID of the user creating the product.
   * @returns {Object} The newly created product.
   */
  static async createProduct(productData, userId) {
    const newProduct = new Product({
      ...productData,
      createdBy: userId,
    });

    const savedProduct = await newProduct.save();

    // Invalidate product cache
    await client.flushAll();

    return savedProduct;
  }

  /**
   * Retrieves a product by its ID.
   * @param {String} id - The product ID.
   * @param {Boolean} isAdminRequest - Whether the request is from an admin.
   * @returns {Object} The product data.
   */
  static async getProductById(id, isAdminRequest) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Product ID", 400);
    }

    const cacheKey = isAdminRequest ? `product:admin:${id}` : `product::${id}`;

    const cached = await client.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit (${isAdminRequest ? 'Admin' : 'Public'})`);
      return JSON.parse(cached);
    }

    let query = Product.findById(id);

    if (!isAdminRequest) {
      query = query.select("-costPrice");
    }

    const product = await query
      .populate("parentCategoryID", "name slug")
      .populate("childCategoryID", "name slug");

    if (!product) {
      throw new AppError("Product Not Found", 404);
    }

    const transformedProduct = {
      ...product.toObject(),
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategorySlug: product.parentCategoryID?.slug || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryID: product.childCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
      childCategorySlug: product.childCategoryID?.slug || null,
    };

    const response = {
      message: "Product Found Successfully",
      data: transformedProduct,
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));

    return response;
  }
  static async getProductBySlug(slug) {
    if (!slug) {
      throw new AppError("Slug is required", 400);
    }

    const cacheKey = `product:slug:${slug}`;

    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (by Slug)");
      return JSON.parse(cached);
    }

    const product = await Product.findOne({
      "seo.slug": slug,
      isDeleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    })
      .select("-rating -reveiws -costPrice")
      .populate("parentCategoryID", "name slug")
      .populate("childCategoryID", "name slug");

    if (!product) {
      throw new AppError("Product Not Found", 404);
    }

    const transformedProduct = {
      ...product.toObject(),
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategorySlug: product.parentCategoryID?.slug || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryID: product.childCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
      childCategorySlug: product.childCategoryID?.slug || null,
    };

    const [reviews, stats] = await Promise.all([
      Review.find({ productId: product._id, status: "approved" })
        .select("-images")
        .populate("userId", "username")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Review.aggregate([
        {
          $match: {
            productId: product._id,
            status: "approved",
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ratingStats = stats[0] || { averageRating: 0, totalReviews: 0 };

    const response = {
      message: "Product Found Successfully",
      data: {
        ...transformedProduct,
        reviews,
        ratingStats: {
          averageRating: Math.round((ratingStats.averageRating || 0) * 10) / 10,
          totalReviews: ratingStats.totalReviews || 0,
        },
      },
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));

    return response;
  }

  static async deleteProduct(id, mode) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Product ID", 400);
    }

    const [orderCount, reviewCount, cartCount] = await Promise.all([
      PostOrder.countDocuments({ "items.productId": id }),
      Review.countDocuments({ productId: id }),
      UserCart.countDocuments({ productId: id }),
    ]);

    const hasDependencies = orderCount > 0 || reviewCount > 0 || cartCount > 0;

    if (hasDependencies && mode !== "soft") {
      const dependencyMessages = [];
      if (orderCount > 0) dependencyMessages.push(`${orderCount} order(s)`);
      if (reviewCount > 0) dependencyMessages.push(`${reviewCount} review(s)`);
      if (cartCount > 0) dependencyMessages.push(`${cartCount} cart item(s)`);

      throw new AppError(
        `This product is linked to ${dependencyMessages.join(", ")}. It cannot be directly deleted. Please Archive (Soft Delete) it instead to preserve history.`,
        400
      );
    }

    let product;
    let actualMode;
    if (mode === "soft" || hasDependencies) {
      product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
      if (!product) throw new AppError("Product Not Found!", 404);
      console.log(`✅ Product ${id} soft-deleted/archived.`);
      actualMode = "soft";
    } else {
      product = await Product.findByIdAndDelete(id);
      if (!product) throw new AppError("Product Not Found!", 404);

      if (product.images && product.images.length > 0) {
        const publicIds = product.images
          .filter((img) => img.publicId)
          .map((img) => img.publicId);

        if (publicIds.length > 0) {
          try {
            await cloudinary.api.delete_resources(publicIds, adminConfig);
            console.log(`✅ Deleted ${publicIds.length} images from Cloudinary`);
          } catch (cloudinaryError) {
            console.error("⚠️ Error deleting images from Cloudinary:", cloudinaryError.message);
          }
        }
      }
      console.log(`✅ Product ${id} permanently deleted.`);
      actualMode = "hard";
    }

    await client.flushAll();

    return {
      message: actualMode === "soft" ? "Product Archived Successfully!" : "Product Permanently Deleted!",
      isDeleted: true,
      mode: actualMode
    };
  }

  static async getAllProducts({
    parentCategoryID,
    childCategoryID,
    parentCategorySlug,
    childCategorySlug,
    mode = "full",
    page = 1,
    limit = 8,
    approvalStatus,
    isAdminRequest,
  }) {
    let approvalFilter = {};

    if (approvalStatus === 'all') {
      approvalFilter = {};
    } else if (approvalStatus) {
      approvalFilter = { approvalStatus };
    } else if (!isAdminRequest) {
      approvalFilter = {
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } },
          { approvalStatus: null }
        ]
      };
    }

    const query = approvalStatus === 'archived'
      ? { isDeleted: true }
      : { ...approvalFilter, isDeleted: { $ne: true } };

    const slugResolutions = [];

    if (parentCategorySlug) {
      slugResolutions.push(
        ParentCategory.findOne({ slug: parentCategorySlug }).lean().then(cat => {
          if (cat) query.parentCategoryID = cat._id;
          else return { error: `Parent Category with slug '${parentCategorySlug}' not found` };
        })
      );
    } else if (parentCategoryID) {
      query.parentCategoryID = parentCategoryID;
    }

    if (childCategorySlug) {
      slugResolutions.push(
        ChildCategory.findOne({ slug: childCategorySlug }).lean().then(cat => {
          if (cat) query.childCategoryID = cat._id;
          else return { error: `Child Category with slug '${childCategorySlug}' not found` };
        })
      );
    } else if (childCategoryID) {
      query.childCategoryID = childCategoryID;
    }

    if (slugResolutions.length > 0) {
      const results = await Promise.all(slugResolutions);
      const errorResult = results.find(r => r && r.error);
      if (errorResult) throw new AppError(errorResult.error, 404);
    }

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 8;
    const skip = (pageNumber - 1) * limitNumber;

    const cacheKey = `products::${new URLSearchParams({
      pID: query.parentCategoryID || "",
      cID: query.childCategoryID || "",
      pS: parentCategorySlug || "",
      cS: childCategorySlug || "",
      m: mode,
      p: pageNumber,
      l: limitNumber,
      as: approvalStatus || "",
      adm: isAdminRequest ? "1" : "0",
    }).toString()}`;

    const cached = await client.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit (mode: ${mode})`);
      return JSON.parse(cached);
    }

    let projection = {};
    if (mode === "seo") {
      projection = { 'seo.slug': 1, parentCategoryID: 0, childCategoryID: 0, _id: 0 };
    } else if (mode === "client") {
      projection = {
        ...commonProjection,
        sku: 0,
        description: 0,
        variants: 0,
        approvalStatus: 0,
        approvalInfo: 0,
        approvalHistory: 0,
      };
    } else if (mode === "admin") {
      projection = {
        ...commonProjection,
        seo: 0,
      };
    } else if (mode === "images") {
      projection = { "images.src": 1, "images.alt": 1, productName: 1, "seo.slug": 1, _id: 0, parentCategoryID: 0, childCategoryID: 0 };
    }

    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .select(projection)
        .populate("parentCategoryID", "name")
        .populate("childCategoryID", "name")
        .sort({ updatedAt: 1 })
        .skip(skip)
        .limit(limitNumber)
        .lean()
        .maxTimeMS(30000),
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalProducts / limitNumber);

    if (products.length === 0) {
      return {
        message: "No Products Found",
        data: [],
      };
    }

    const productList = products.map((product) => {
      if (mode === "seo" || mode === "images") return product;

      return {
        ...product,
        parentCategoryName: product.parentCategoryID?.name || null,
        parentCategoryID: product.parentCategoryID?._id || null,
        childCategoryName: product.childCategoryID?.name || null,
        childCategoryID: product.childCategoryID?._id || null,
      };
    });

    const response = {
      message: "Products Retrieved Successfully",
      data: productList,
      ...((mode === "seo" || mode === "images") ? {} : {
        pagination: {
          totalProducts,
          totalPages,
          currentPage: pageNumber,
          pageSize: limitNumber,
        }
      }),
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));
    return response;
  }

  static async updateProduct(id, updateData, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Product ID", 400);
    }

    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      throw new AppError("Product Not Found", 404);
    }

    // --- Cloudinary orphan cleanup ---
    // If the incoming update includes a new images array, find which old images
    // were removed and delete them from Cloudinary before saving.
    if (updateData.images && Array.isArray(updateData.images)) {
      const incomingPublicIds = new Set(
        updateData.images
          .map((img) => img.publicId)
          .filter(Boolean)
      );

      const removedPublicIds = (currentProduct.images || [])
        .filter((img) => img.publicId && !incomingPublicIds.has(img.publicId))
        .map((img) => img.publicId);

      if (removedPublicIds.length > 0) {
        try {
          await cloudinary.api.delete_resources(removedPublicIds, adminConfig);
          console.log(`✅ Deleted ${removedPublicIds.length} removed image(s) from Cloudinary:`, removedPublicIds);
        } catch (cloudinaryError) {
          // Log but do not block the product update
          console.error("⚠️ Error deleting removed images from Cloudinary:", cloudinaryError.message);
        }
      }
    }
    // --- End Cloudinary cleanup ---

    if (currentProduct.approvalStatus === 'rejected') {
      updateData.approvalStatus = 'pending';
      updateData.$push = {
        approvalHistory: {
          action: 'resubmitted',
          performedBy: userId,
          performedAt: new Date(),
          comments: 'Product edited and auto-resubmitted for approval'
        }
      };
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      throw new AppError("Product Not Found", 404);
    }
    await client.flushAll();

    const responseMessage = currentProduct.approvalStatus === 'rejected'
      ? "Product Updated Successfully and resubmitted for approval"
      : "Product Updated Successfully";

    return {
      message: responseMessage,
      data: updatedProduct,
      resubmitted: currentProduct.approvalStatus === 'rejected'
    };
  }

  static async getProductRelatedInfo({
    parentCategorySlug,
    childCategorySlug,
    categoryId,
    productId
  }) {
    const cacheKey = `products-related-info::${new URLSearchParams({
      pS: parentCategorySlug || "",
      cS: childCategorySlug || "",
      cID: categoryId || "",
      pID: productId || ""
    }).toString()}`;

    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (related-info)");
      return JSON.parse(cached);
    }

    let resolvedParentID = null;
    let resolvedChildID = null;

    const slugResolutions = [];
    if (parentCategorySlug) {
      slugResolutions.push(
        ParentCategory.findOne({ slug: parentCategorySlug }).lean().then(cat => {
          if (cat) resolvedParentID = cat._id.toString();
        })
      );
    }
    if (childCategorySlug) {
      slugResolutions.push(
        ChildCategory.findOne({ slug: childCategorySlug }).lean().then(cat => {
          if (cat) resolvedChildID = cat._id.toString();
        })
      );
    }
    await Promise.all(slugResolutions);

    const approvalFilter = {
      isDeleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    };

    const projection = {
      ...commonProjection,
      sku: 0,
      description: 0,
      variants: 0,
    };

    const [relatedResults, recommendedResults] = await Promise.all([
      resolvedParentID ? Product.find({
        ...approvalFilter,
        parentCategoryID: resolvedParentID,
        _id: { $ne: productId }
      })
        .select(projection)
        .populate("parentCategoryID", "name slug")
        .populate("childCategoryID", "name slug")
        .sort({ updatedAt: 1 })
        .lean() : Promise.resolve([]),

      (async () => {
        let recQuery = { ...approvalFilter, _id: { $ne: productId } };
        let effectiveCategoryId = categoryId;

        if (!effectiveCategoryId && resolvedParentID) effectiveCategoryId = resolvedParentID;

        if (effectiveCategoryId) {
          const category = await ParentCategory.findById(effectiveCategoryId).lean();
          if (category && category.recommendedCategories && category.recommendedCategories.length > 0) {
            recQuery.parentCategoryID = { $in: category.recommendedCategories };
          } else {
            return [];
          }
        } else {
          const categoriesWithRules = await ParentCategory.find({
            recommendedCategories: { $exists: true, $not: { $size: 0 } }
          }).select("_id").lean();

          if (categoriesWithRules.length > 0) {
            recQuery.parentCategoryID = { $in: categoriesWithRules.map(c => c._id) };
          } else {
            return [];
          }
        }

        return Product.find(recQuery)
          .select(projection)
          .populate("parentCategoryID", "name slug")
          .populate("childCategoryID", "name slug")
          .sort({ updatedAt: 1 })
          .limit(8)
          .lean();
      })()
    ]);

    const transformProduct = (product) => ({
      ...product,
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategorySlug: product.parentCategoryID?.slug || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
      childCategorySlug: product.childCategoryID?.slug || null,
      childCategoryID: product.childCategoryID?._id || null,
    });

    const response = {
      message: "Related and Recommended Products Retrieved Successfully",
      data: {
        related: relatedResults.map(transformProduct),
        recommended: recommendedResults.map(transformProduct)
      }
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));

    return response;
  }
}

export default ProductService;

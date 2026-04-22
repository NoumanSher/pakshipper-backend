import client from "../../config/redis/redisClient.js";
import Product from "../../models/products.js";
import mongoose from "mongoose";
import cloudinary from "../../utils/cloudinary.js";
import { adminConfig } from "../../utils/cloudinaryAdmin.js";
import ParentCategory from "../../models/categories.js";
import ChildCategory from "../../models/child-categories.js";
import Review from "../../models/Review.js";
import PostOrder from "../../models/post-order.js";
import UserCart from "../../models/UserCart.js";

let commonProjection = {
  // parentCategoryID: 0,
  // childCategoryID: 0,
  // parentCategoryName: 0,
  // childCategoryName: 0,
  images: { $slice: 1 },
  costPrice: 0,
  description: 0,
  options: 0,
  __v: 0,
}

// create Products
export const createProduct = async (req, res) => {
  try {
    const {
      productName,
      parentCategoryID,
      childCategoryID,
      description,
      isVariant,
      salePrice,
      sku,
      costPrice,
      isLimited,
      stock,
      discount,
      isNew,
      isRecommended,
      images,
      options,
      variants,
      seo,
    } = req.body;
    const newProduct = new Product({
      productName,
      parentCategoryID,
      childCategoryID,
      description,
      isVariant,
      salePrice,
      sku,
      costPrice,
      stock,
      isLimited,
      discount,
      isNew,
      isRecommended,
      images,
      options,
      variants,
      seo,
      createdBy: req.user.id || req.user._id, // Save the creator's ID
    });
    const savedProduct = await newProduct.save();
    await client.flushAll();

    res
      .status(201)
      .json({ message: "Product Added SuccesFully!", savedProduct });
  } catch (error) {
    res.status(500).json({ message: "Error Creating Product", error });
  }
};
// Product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }
    // Check if the request is from an admin
    const isAdminRequest = req.user && (
      req.user.role === 'admin' ||
      req.user.permissions?.includes('product_approval') ||
      req.user.permissions?.includes('read:products')
    );

    const cacheKey = isAdminRequest ? `product:admin:${id}` : `product::${id}`;

    // 🔍 Check Redis cache
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit (${isAdminRequest ? 'Admin' : 'Public'})`);
      return res.status(200).json(JSON.parse(cached));
    }

    let query = Product.findById(id);

    // Only exclude costPrice for non-admins
    if (!isAdminRequest) {
      query = query.select("-costPrice");
    }

    const product = await query
      .populate("parentCategoryID", "name slug")
      .populate("childCategoryID", "name slug");
    if (!product) {
      return res.status(404).json({ message: "Product Not Found" });
    }
    // Transform the product data to rename fields
    const transformedProduct = {
      ...product.toObject(),
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategorySlug: product.parentCategoryID?.slug || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryID: product.childCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
      childCategorySlug: product.childCategoryID?.slug || null,
    };

    // // Remove the original parentCategoryID and childCategoryID
    // delete transformedProduct.parentCategoryID;
    // delete transformedProduct.childCategoryID;
    const response = {
      message: "Product Found Successfully",
      data: transformedProduct,
    };

    // 💾 Cache result
    await client.setEx(cacheKey, 300, JSON.stringify(response));

    res.status(200).json(response);

    // res.status(200).json({
    //   message: "Product Found Successfully",
    //   data: transformedProduct,
    // });
  } catch (error) {
    console.error("Error fetching product:", error);
    res
      .status(500)
      .json({ message: "Error Fetching Product", error: error.message });
  }
};

// Product by Slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ message: "Slug is required" });
    }

    const cacheKey = `product:slug:${slug}`;

    // 🔍 Check Redis cache
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (by Slug)");
      return res.status(200).json(JSON.parse(cached));
    }

    // Only return approved products for public API (or products without approval status for backward compatibility)
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
      return res.status(404).json({ message: "Product Not Found" });
    }

    // Transform the product data to rename fields
    const transformedProduct = {
      ...product.toObject(),
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategorySlug: product.parentCategoryID?.slug || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryID: product.childCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
      childCategorySlug: product.childCategoryID?.slug || null,
    };

    // 🌟 Fetch approved reviews and rating stats
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

    // 💾 Cache result
    await client.setEx(cacheKey, 300, JSON.stringify(response));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    res
      .status(500)
      .json({ message: "Error Fetching Product", error: error.message });
  }
};
// Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.query; // 'soft' or 'hard'

    // Validate the ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }

    // Check for dependencies
    const [orderCount, reviewCount, cartCount] = await Promise.all([
      PostOrder.countDocuments({ "items.productId": id }),
      Review.countDocuments({ productId: id }),
      UserCart.countDocuments({ productId: id }),
    ]);

    const hasDependencies = orderCount > 0 || reviewCount > 0 || cartCount > 0;

    // If dependencies exist and mode is not 'soft', block deletion
    if (hasDependencies && mode !== "soft") {
      const dependencyMessages = [];
      if (orderCount > 0) dependencyMessages.push(`${orderCount} order(s)`);
      if (reviewCount > 0) dependencyMessages.push(`${reviewCount} review(s)`);
      if (cartCount > 0) dependencyMessages.push(`${cartCount} cart item(s)`);

      return res.status(400).json({
        message: `This product is linked to ${dependencyMessages.join(", ")}. It cannot be directly deleted. Please Archive (Soft Delete) it instead to preserve history.`,
        dependencies: { orderCount, reviewCount, cartCount },
        canSoftDelete: true
      });
    }

    let product;
    if (mode === "soft" || hasDependencies) {
      // Soft Delete / Archive
      product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
      if (!product) {
        return res.status(404).json({ message: "Product Not Found!" });
      }
      console.log(`✅ Product ${id} soft-deleted/archived.`);
    } else {
      // Hard Delete (only if no dependencies and not explicitly soft)
      product = await Product.findByIdAndDelete(id);
      if (!product) {
        return res.status(404).json({ message: "Product Not Found!" });
      }

      // Delete associated images from Cloudinary only on hard delete
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
    }

    await client.flushAll();

    res.status(200).json({
      message: mode === "soft" || hasDependencies ? "Product Archived Successfully!" : "Product Permanently Deleted!",
      isDeleted: true,
      mode: mode === "soft" || hasDependencies ? "soft" : "hard"
    });
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    res.status(500).json({ message: "Error Deleting Product", error: error.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      parentCategoryID,
      childCategoryID,
      parentCategorySlug,
      childCategorySlug,
      mode = "full", // Default mode is full if not specified
      page = 1,
      limit = 8,
      approvalStatus, // NEW: Filter by approval status
    } = req.query;

    // Check if the request is from an admin/approver user
    const isAdminRequest = req.user && (
      req.user.role === 'admin' ||
      req.user.permissions?.includes('product_approval') ||
      req.user.permissions?.includes('read:products')
    );


    // Build approval status filter
    let approvalFilter = {};

    if (approvalStatus === 'all') {
      // 'all' means show everything - no filter
      approvalFilter = {};
    } else if (approvalStatus) {
      // Specific status requested (pending, approved, rejected)
      approvalFilter = { approvalStatus };
    } else if (!isAdminRequest) {
      // Public users (no status specified): only show approved products or products without status (backward compatibility)
      approvalFilter = {
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } },
          { approvalStatus: null }
        ]
      };
    }
    // If admin and no status specified, show all products (no filter)

    // If archived status is requested, only show deleted products regardless of approval status
    // Otherwise, show non-deleted products filtered by approval status
    const query = approvalStatus === 'archived'
      ? { isDeleted: true }
      : { ...approvalFilter, isDeleted: { $ne: true } };

    // 🔍 Resolve Slugs to IDs in parallel if provided
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
      if (errorResult) return res.status(404).json({ message: errorResult.error });
    }

    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 8;
    const skip = (pageNumber - 1) * limitNumber;

    // 🔑 Generate Redis cache key (including mode and approval status)
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

    // 🧪 Cache check
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit (mode: ${mode})`);
      return res.status(200).json(JSON.parse(cached));
    }

    // Define projection based on mode

    let projection = {};
    if (mode === "seo") {
      projection = { 'seo.slug': 1, parentCategoryID: 0, childCategoryID: 0, _id: 0 };
    } else if (mode === "client") {
      projection = {
        ...commonProjection,
        sku: 0,
        description: 0,
        variants: 0,
        // discount: 0, // Enabled discount visibility for storefront
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

    // ⚡ Parallel execution of finding products and counting total
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
      return res.status(200).json({
        message: "No Products Found",
        data: [],
      });
    }

    // Prepare response mapping based on mode
    const productList = products.map((product) => {
      // For SEO mode, we don't need to transform much beyond basic fields
      if (mode === "seo") return product;
      if (mode === "images") return product;
      if (mode === "client") return product;
      if (mode === "admin") return product;

      // For client and admin, we transform categories
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

    // 💾 Cache for 5 minutes (300 seconds)
    await client.setEx(cacheKey, 300, JSON.stringify(response));
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      message: "Error Fetching Products",
      error: error.message,
    });
  }
};

// export const getAllProductss = async (req, res) => {
//   try {
//     const {
//       parentCategoryID,
//       childCategoryID,
//       page = 1,
//       limit = 8,
//       search = "", // <-- new search parameter
//     } = req.query;

//     // Build the query object
//     const query = {};
//     if (parentCategoryID) query.parentCategoryID = parentCategoryID;
//     if (childCategoryID) query.childCategoryID = childCategoryID;
//     if (search) {
//       query.productName = { $regex: search, $options: "i" }; // case-insensitive partial match
//     }

//     const pageNumber = parseInt(page, 10);
//     const limitNumber = parseInt(limit, 10);
//     const skip = (pageNumber - 1) * limitNumber;

//     // 🔑 Update cache key to include search
//     const cacheKey = `products::${new URLSearchParams({
//       parentCategoryID: parentCategoryID || "",
//       childCategoryID: childCategoryID || "",
//       page: String(page),
//       limit: String(limit),
//       search,
//     }).toString()}`;

//     const cached = await client.get(cacheKey);
//     if (cached) {
//       console.log("✅ Cache hit");
//       return res.status(200).json(JSON.parse(cached));
//     }

//     const products = await Product.find(query)
//       .populate("parentCategoryID", "name")
//       .populate("childCategoryID", "name")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limitNumber)
//       .lean();

//     const totalProducts = await Product.countDocuments(query);
//     const totalPages = Math.ceil(totalProducts / limitNumber);

//     if (products.length === 0) {
//       return res.status(200).json({
//         message: "No Products Found",
//         data: [],
//       });
//     }

//     const productList = products.map((product) => ({
//       _id: product._id,
//       parentCategoryID: product.parentCategoryID._id,
//       childCategoryID: product.childCategoryID?._id,
//       productName: product.productName,
//       description: product.description,
//       salePrice: product.salePrice,
//       stock: product.stock,
//       discount: product.discount,
//       sku: product.sku,
//       isNew: product.isNew,
//       images: product.images,
//       options: product.options,
//       variants: product.variants,
//       isVariant: product.isVariant,
//       seo: product.seo,
//     }));

//     const response = {
//       message: "Products Retrieved Successfully",
//       data: productList,
//       pagination: {
//         totalProducts,
//         totalPages,
//         currentPage: pageNumber,
//         pageSize: limitNumber,
//       },
//     };

//     await client.setEx(cacheKey, 300, JSON.stringify(response));
//     res.status(200).json(response);
//   } catch (error) {
//     console.error("Error fetching products:", error);
//     res.status(500).json({
//       message: "Error Fetching Products",
//       error: error.message,
//     });
//   }
// };


export const getProductsByCategoryPriority = async (req, res) => {
  try {
    const {
      parentCategoryID,
      childCategoryID,
      parentCategorySlug,
      childCategorySlug,
    } = req.query;

    let resolvedParentID = parentCategoryID;
    let resolvedChildID = childCategoryID;

    // 🔍 Resolve Slugs to IDs in parallel if provided
    const slugResolutions = [];

    if (parentCategorySlug) {
      slugResolutions.push(
        ParentCategory.findOne({ slug: parentCategorySlug }).lean().then(cat => {
          if (cat) resolvedParentID = cat._id.toString();
          else return { error: `Parent Category with slug '${parentCategorySlug}' not found` };
        })
      );
    }

    if (childCategorySlug) {
      slugResolutions.push(
        ChildCategory.findOne({ slug: childCategorySlug }).lean().then(cat => {
          if (cat) resolvedChildID = cat._id.toString();
          else return { error: `Child Category with slug '${childCategorySlug}' not found` };
        })
      );
    }

    if (slugResolutions.length > 0) {
      const results = await Promise.all(slugResolutions);
      const errorResult = results.find(r => r && r.error);
      if (errorResult) return res.status(404).json({ message: errorResult.error });
    }

    // Validate input
    if (!resolvedParentID) {
      return res.status(400).json({ message: "Parent Category ID or Slug is required" });
    }

    // 🔑 Cache key
    const cacheKey = `products-priority::${new URLSearchParams({
      pID: resolvedParentID || "",
      cID: resolvedChildID || "",
      pS: parentCategorySlug || "",
      cS: childCategorySlug || "",
    }).toString()}`;

    // 🧪 Cache check
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (priority)");
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch products with slice and projection
    let projection = {
      ...commonProjection,
      sku: 0,
      description: 0,
      variants: 0,
      // discount: 0

    };
    // Only show approved products on public API (or products without approval status for backward compatibility)
    const products = await Product.find({
      parentCategoryID: resolvedParentID,
      isDeleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    })
      .select(projection)
      .populate("parentCategoryID", "name slug")
      .populate("childCategoryID", "name slug")
      .sort({ updatedAt: 1 })
      .lean();

    if (products.length === 0) {
      return res.status(404).json({ message: "No Products Found" });
    }

    // Organize products by priority
    const prioritizedProducts = [];
    const otherProducts = [];

    products.forEach((product) => {
      const productData = {
        ...product,
        // parentCategoryName: product.parentCategoryID?.name || null,
        // parentCategorySlug: product.parentCategoryID?.slug || null,
        // childCategoryName: product.childCategoryID?.name || null,
        // childCategorySlug: product.childCategoryID?.slug || null,
        // parentCategoryID: product.parentCategoryID?._id,
        // childCategoryID: product.childCategoryID?._id,
      };

      if (product.childCategoryID?._id.toString() === resolvedChildID) {
        prioritizedProducts.push(productData);
      } else {
        otherProducts.push(productData);
      }
    });

    const allProducts = [...prioritizedProducts, ...otherProducts];
    const response = {
      message: "Products Retrieved Successfully",
      data: allProducts,
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error Fetching Products", error: error.message });
  }
};
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.user?.id;

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }

    // Extract the updated data from the request body
    const {
      productName,
      parentCategoryID,
      childCategoryID,
      description,
      isVariant,
      salePrice,
      sku,
      costPrice,
      stock,
      discount,
      isNew,
      isRecommended,
      isLimited,
      images,
      options,
      variants,
      seo,
      isDeleted,
    } = req.body;

    // First, get the current product to check approval status
    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      return res.status(404).json({ message: "Product Not Found" });
    }

    // Build update object
    const updateData = {
      productName,
      parentCategoryID,
      childCategoryID,
      description,
      isVariant,
      salePrice,
      sku,
      costPrice,
      isLimited,
      stock,
      discount,
      isNew,
      isRecommended,
      images,
      options,
      variants,
      seo,
      isDeleted,
    };

    // Auto-resubmit: If product was rejected and is being edited, change status to pending
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

    // Ownership check is handled by middleware - proceed with update
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true } // Return the updated product and enforce schema validation
    );

    // Check if the product was found and updated
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product Not Found" });
    }
    await client.flushAll();

    const responseMessage = currentProduct.approvalStatus === 'rejected'
      ? "Product Updated Successfully and resubmitted for approval"
      : "Product Updated Successfully";

    res.status(200).json({
      message: responseMessage,
      data: updatedProduct,
      resubmitted: currentProduct.approvalStatus === 'rejected'
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res
      .status(500)
      .json({ message: "Error Updating Product", error: error.message });
  }
};

export const getLimitedProducts = async (req, res) => {
  try {
    const cacheKey = "products::limited";
    // 🔍 Try getting from cache
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (limited)");
      return res.status(200).json(JSON.parse(cached));
    }
    // Query to find all products with isLimited = true
    // Only show approved products on public API (or products without approval status for backward compatibility)
    const limitedProducts = await Product.find({
      isLimited: true,
      isDeleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    })
      .select({
        costPrice: 0,
        images: { $slice: 1 }
      })
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name")
      .sort({ updatedAt: 1 })
      .lean();

    if (limitedProducts.length === 0) {
      return res.status(404).json({ message: "No Limited Products Found" });
    }

    // Format and return the response
    const formattedProducts = limitedProducts.map((product) => ({
      ...product,
      parentCategoryID: product.parentCategoryID?._id,
      childCategoryID: product.childCategoryID?._id,
      parentCategoryName: product.parentCategoryID?.name || null,
      childCategoryName: product.childCategoryID?.name || null,
    }));
    const response = {
      message: "Limited Products Retrieved Successfully",
      data: formattedProducts,
    };

    // 💾 Cache it
    await client.setEx(cacheKey, 300, JSON.stringify(response)); // 5 min

    res.status(200).json(response);

    // res.status(200).json({
    //   message: "Limited Products Retrieved Successfully",
    //   data: formattedProducts,
    // });
  } catch (error) {
    console.error("Error fetching limited products:", error);
    res.status(500).json({
      message: "Error Fetching Limited Products",
      error: error.message,
    });
  }
};

export const getRecommendedProducts = async (req, res) => {
  try {
    const cacheKey = "products::recommended";
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (recommended)");
      return res.status(200).json(JSON.parse(cached));
    }
    
    const recommendedProducts = await Product.find({
      isRecommended: true,
      isDeleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
        { approvalStatus: null }
      ]
    })
      .select({
        costPrice: 0,
        images: { $slice: 1 }
      })
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name")
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean();

    if (recommendedProducts.length === 0) {
      return res.status(404).json({ message: "No Recommended Products Found" });
    }

    const formattedProducts = recommendedProducts.map((product) => ({
      ...product,
      parentCategoryID: product.parentCategoryID?._id,
      childCategoryID: product.childCategoryID?._id,
      parentCategoryName: product.parentCategoryID?.name || null,
      childCategoryName: product.childCategoryID?.name || null,
    }));
    
    const response = {
      message: "Recommended Products Retrieved Successfully",
      data: formattedProducts,
    };

    await client.setEx(cacheKey, 300, JSON.stringify(response));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching recommended products:", error);
    res.status(500).json({
      message: "Error Fetching Recommended Products",
      error: error.message,
    });
  }
};

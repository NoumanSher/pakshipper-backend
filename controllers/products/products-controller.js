import client from "../../config/redis/redisClient.js";
import Product from "../../models/products.js";
import mongoose from "mongoose";
import cloudinary from "../../utils/cloudinary.js";
import { adminConfig } from "../../utils/cloudinaryAdmin.js";
import ParentCategory from "../../models/categories.js";
import ChildCategory from "../../models/child-categories.js";

let commonProjection = {
  parentCategoryID: 0,
  childCategoryID: 0,
  parentCategoryName: 0,
  childCategoryName: 0,
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
      images,
      options,
      variants,
      seo,
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
    const cacheKey = `product::${id}`;

    // 🔍 Check Redis cache
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (by ID)");
      return res.status(200).json(JSON.parse(cached));
    }

    const product = await Product.findById(id)
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

    const product = await Product.findOne({ "seo.slug": slug })
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

    const response = {
      message: "Product Found Successfully",
      data: transformedProduct,
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
    // Validate the ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Product ID" });
    }
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ message: "Product Not Found!" });
    }

    // Delete associated images from Cloudinary
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
          // Continue with product deletion even if Cloudinary deletion fails
        }
      }
    }

    await client.flushAll();

    res.status(200).json({
      message: "Product Deleted Successfully!",
      deletedImagesCount: product.images ? product.images.length : 0
    });
  } catch (error) {
    res.status(500).json({ message: "Error Deleting Product", error });
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
    } = req.query;

    const query = {};

    // 🔍 Resolve Slugs to IDs in parallel if provided
    const slugResolutions = [];

    if (parentCategorySlug) {
      slugResolutions.push(
        ParentCategory.findOne({ slug: parentCategorySlug }).lean().then(cat => {
          if (cat) query.parentCategoryID = cat._id;
          else return { error: "Parent Category not found by slug" };
        })
      );
    } else if (parentCategoryID) {
      query.parentCategoryID = parentCategoryID;
    }

    if (childCategorySlug) {
      slugResolutions.push(
        ChildCategory.findOne({ slug: childCategorySlug }).lean().then(cat => {
          if (cat) query.childCategoryID = cat._id;
          else return { error: "Child Category not found by slug" };
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

    // 🔑 Generate Redis cache key (including mode)
    const cacheKey = `products::${new URLSearchParams({
      pID: query.parentCategoryID || "",
      cID: query.childCategoryID || "",
      pS: parentCategorySlug || "",
      cS: childCategorySlug || "",
      m: mode,
      p: pageNumber,
      l: limitNumber,
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
      projection = { seo: 1, parentCategoryID: 0, childCategoryID: 0, _id: 0 };
    } else if (mode === "client") {
      projection = {
        ...commonProjection,
        sku: 0,
        description: 0,
        variants: 0,
        discount: 0

      };
    } else if (mode === "admin") {
      projection = {
        ...commonProjection,

        seo: 0,
      };
    }

    // ⚡ Parallel execution of finding products and counting total
    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .select(projection)
        .populate("parentCategoryID", "name")
        .populate("childCategoryID", "name")
        .sort({ createdAt: -1 })
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
      ...(mode === "seo" ? {} : {
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
          else return { error: "Parent Category not found by slug" };
        })
      );
    }

    if (childCategorySlug) {
      slugResolutions.push(
        ChildCategory.findOne({ slug: childCategorySlug }).lean().then(cat => {
          if (cat) resolvedChildID = cat._id.toString();
          else return { error: "Child Category not found by slug" };
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
      discount: 0

    };
    const products = await Product.find({ parentCategoryID: resolvedParentID })
      .select(projection)
      .populate("parentCategoryID", "name slug")
      .populate("childCategoryID", "name slug")
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
      isLimited,
      images,
      options,
      variants,
      seo,
    } = req.body;

    // Find the product and update it
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
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
        images,
        options,
        variants,
        seo,
      },
      { new: true, runValidators: true } // Return the updated product and enforce schema validation
    );

    // Check if the product was found and updated
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product Not Found" });
    }
    await client.flushAll();

    res.status(200).json({
      message: "Product Updated Successfully",
      data: updatedProduct,
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
    const limitedProducts = await Product.find({ isLimited: true })
      .select({
        costPrice: 0,
        images: { $slice: 1 }
      })
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name")
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

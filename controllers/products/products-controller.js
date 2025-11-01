import client from "../../config/redis/redisClient.js";
import Product from "../../models/products.js";
import mongoose from "mongoose";
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
      .populate("parentCategoryID", "name") // Populate with only the name field
      .populate("childCategoryID", "name"); // Populate with only the name field
    if (!product) {
      return res.status(404).json({ message: "Product Not Found" });
    }
    // Transform the product data to rename fields
    const transformedProduct = {
      ...product.toObject(),
      parentCategoryName: product.parentCategoryID?.name || null,
      parentCategoryID: product.parentCategoryID?._id || null,
      childCategoryID: product.childCategoryID?._id || null,
      childCategoryName: product.childCategoryID?.name || null,
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
      res.status(404).json({ message: "Product Not Found!" });
    }
    await client.flushAll();

    res.status(200).json({ message: "Product Deleted Successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error Deleting Product", error });
  }
};
export const getAllProducts = async (req, res) => {
  try {
    const {
      parentCategoryID,
      childCategoryID,
      page = 1,
      limit = 8,
    } = req.query;

    // Build the query object based on provided parameters
    const query = {};
    if (parentCategoryID) query.parentCategoryID = parentCategoryID;
    if (childCategoryID) query.childCategoryID = childCategoryID;

    // Convert page and limit to numbers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const skip = (pageNumber - 1) * limitNumber;

    // 🔑 Generate a Redis cache key
    const cacheKey = `products::${new URLSearchParams({
      parentCategoryID: parentCategoryID || "",
      childCategoryID: childCategoryID || "",
      page: String(page),
      limit: String(limit),
    }).toString()}`;

    // 🧪 Try fetching from Redis first
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit");
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch products with pagination and populate categories
    const products = await Product.find(query)
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // console.log(products);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNumber);

    if (products.length === 0) {
      return res.status(200).json({
        message: "No Products Found",
        data: [],
      });
    }

    // Prepare the products list with only the necessary product details
    const productList = products.map((product) => ({
      _id: product._id,
      parentCategoryID: product.parentCategoryID._id,
      parentCategoryName: product.parentCategoryID.name,
      childCategoryID: product.childCategoryID?._id,
      childCategoryName: product.childCategoryID?.name,
      productName: product.productName,
      description: product.description,
      salePrice: product.salePrice,
      stock: product.stock,
      discount: product.discount,
      sku: product.sku,
      isNew: product.isNew,
      images: product.images,
      options: product.options,
      variants: product.variants,
      isVariant: product.isVariant,
      seo: product.seo,
    }));
    const response = {
      message: "Products Retrieved Successfully",
      data: productList,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
    };

    // 💾 Cache the response for 5 minutes
    await client.setEx(cacheKey, 300, JSON.stringify(response));
    res.status(200).json(response);

    // res.status(200).json({
    //   message: "Products Retrieved Successfully",
    //   data: productList,
    //   pagination: {
    //     totalProducts,
    //     totalPages,
    //     currentPage: pageNumber,
    //     pageSize: limitNumber,
    //   },
    // });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      message: "Error Fetching Products",
      error: error.message,
    });
  }
};
export const getAllProductss = async (req, res) => {
  try {
    const {
      parentCategoryID,
      childCategoryID,
      page = 1,
      limit = 8,
      search = "", // <-- new search parameter
    } = req.query;

    // Build the query object
    const query = {};
    if (parentCategoryID) query.parentCategoryID = parentCategoryID;
    if (childCategoryID) query.childCategoryID = childCategoryID;
    if (search) {
      query.productName = { $regex: search, $options: "i" }; // case-insensitive partial match
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // 🔑 Update cache key to include search
    const cacheKey = `products::${new URLSearchParams({
      parentCategoryID: parentCategoryID || "",
      childCategoryID: childCategoryID || "",
      page: String(page),
      limit: String(limit),
      search,
    }).toString()}`;

    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit");
      return res.status(200).json(JSON.parse(cached));
    }

    const products = await Product.find(query)
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNumber);

    if (products.length === 0) {
      return res.status(200).json({
        message: "No Products Found",
        data: [],
      });
    }

    const productList = products.map((product) => ({
      _id: product._id,
      parentCategoryID: product.parentCategoryID._id,
      childCategoryID: product.childCategoryID?._id,
      productName: product.productName,
      description: product.description,
      salePrice: product.salePrice,
      stock: product.stock,
      discount: product.discount,
      sku: product.sku,
      isNew: product.isNew,
      images: product.images,
      options: product.options,
      variants: product.variants,
      isVariant: product.isVariant,
      seo: product.seo,
    }));

    const response = {
      message: "Products Retrieved Successfully",
      data: productList,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
      },
    };

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


export const getProductsByCategoryPriority = async (req, res) => {
  try {
    debugger;
    const { parentCategoryID, childCategoryID } = req.query;
    // console.log(parentCategoryID);
    // console.log(childCategoryID);
    // Validate input
    if (!parentCategoryID) {
      return res
        .status(400)
        .json({ message: "Parent Category ID is required" });
    }
    // 🔑 Create a unique cache key
    const cacheKey = `products-priority::${new URLSearchParams({
      parentCategoryID,
      childCategoryID: childCategoryID || "",
    }).toString()}`;

    // 🧪 Check Redis cache
    const cached = await client.get(cacheKey);
    if (cached) {
      console.log("✅ Cache hit (priority)");
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch all products under the parentCategoryID
    const products = await Product.find({ parentCategoryID })
      .populate("parentCategoryID", "name")
      .populate("childCategoryID", "name");
    // console.log(products);

    if (products.length === 0) {
      return res.status(404).json({ message: "No Products Found" });
    }

    // Organize products by priority
    const prioritizedProducts = [];
    const otherProducts = [];

    products.forEach((product) => {
      const productData = {
        _id: product._id,
        productName: product.productName,
        description: product.description,
        parentCategoryID: product.parentCategoryID?._id,
        childCategoryID: product.childCategoryID?._id,
        salePrice: product.salePrice,
        stock: product.stock,
        discount: product.discount,
        sku: product.sku,
        isNew: product.isNew,
        images: product.images,
        options: product.options,
        variants: product.variants,
        isVariant: product.isVariant,
        seo: product.seo,
        parentCategoryName: product.parentCategoryID?.name || null,
        childCategoryName: product.childCategoryID?.name || null,
      };

      if (product.childCategoryID?._id.toString() === childCategoryID) {
        prioritizedProducts.push(productData);
      } else {
        otherProducts.push(productData);
      }
    });

    // Combine prioritized and other products into one array
    const allProducts = [...prioritizedProducts, ...otherProducts];
    const response = {
      message: "Products Retrieved Successfully",
      data: allProducts,
    };

    // 💾 Cache the final result
    await client.setEx(cacheKey, 300, JSON.stringify(response)); // 5 minutes

    res.status(200).json(response);

    // res
    //   .status(200)
    //   .json({ message: "Products Retrieved Successfully", data: allProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ message: "Error Fetching Products", error: error.message });
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
      .populate("parentCategoryID", "name") // Populate parent category name
      .populate("childCategoryID", "name"); // Populate child category name

    if (limitedProducts.length === 0) {
      return res.status(404).json({ message: "No Limited Products Found" });
    }

    // Format and return the response
    const formattedProducts = limitedProducts.map((product) => ({
      _id: product._id,
      productName: product.productName,
      description: product.description,
      parentCategoryID: product.parentCategoryID._id,
      childCategoryID: product.childCategoryID?._id,
      salePrice: product.salePrice,
      stock: product.stock,
      discount: product.discount,
      sku: product.sku,
      isNew: product.isNew,
      isLimited: product.isLimited,
      images: product.images,
      options: product.options,
      variants: product.variants,
      seo: product.seo,
      isVariant: product.isVariant,
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

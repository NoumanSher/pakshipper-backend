
import ProductService from "../../services/productService.js";
import { z } from "zod";
import asyncHandler from "../../middlewares/asyncHandler.js";

const productSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  parentCategoryID: z.string(),
  childCategoryID: z.string().nullable().optional(),
  description: z.string(),
  isVariant: z.boolean().optional(),
  salePrice: z.number().min(0, "Sale price must be non-negative"),
  sku: z.string().min(1, "SKU is required"),
  costPrice: z.number().min(0),
  isLimited: z.boolean().optional(),
  stock: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  isNew: z.boolean().optional(),
  images: z.array(z.any()).optional(),
  options: z.array(z.any()).optional(),
  variants: z.array(z.any()).optional(),
  seo: z.any(),
});

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
export const createProduct = asyncHandler(async (req, res, next) => {
  // Validate request body
  const validatedData = productSchema.parse(req.body);

  const savedProduct = await ProductService.createProduct(
    validatedData,
    req.user.id || req.user._id
  );

  res.status(201).json({
    status: 'success',
    message: "Product Added Successfully!",
    data: savedProduct
  });
});
// Product by ID
export const getProductById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if the request is from an admin
  const isAdminRequest = req.user && (
    req.user.role === 'admin' ||
    req.user.permissions?.includes('product_approval') ||
    req.user.permissions?.includes('read:products')
  );

  const response = await ProductService.getProductById(id, isAdminRequest);

  res.status(200).json(response);
});

// Product by Slug
export const getProductBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const response = await ProductService.getProductBySlug(slug);
  res.status(200).json(response);
});
// Delete Product
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { mode } = req.query; // 'soft' or 'hard'

  const response = await ProductService.deleteProduct(id, mode);

  res.status(200).json(response);
});

export const getAllProducts = asyncHandler(async (req, res, next) => {
  const {
    parentCategoryID,
    childCategoryID,
    parentCategorySlug,
    childCategorySlug,
    mode = "full",
    page = 1,
    limit = 8,
    approvalStatus,
  } = req.query;

  // Check if the request is from an admin/approver user
  const isAdminRequest = req.user && (
    req.user.role === 'admin' ||
    req.user.permissions?.includes('product_approval') ||
    req.user.permissions?.includes('read:products')
  );

  const response = await ProductService.getAllProducts({
    parentCategoryID,
    childCategoryID,
    parentCategorySlug,
    childCategorySlug,
    mode,
    page,
    limit,
    approvalStatus,
    isAdminRequest
  });

  res.status(200).json(response);
});



export const updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user?._id || req.user?.id;

  // Validate request body
  const validatedData = productSchema.partial().parse(req.body);

  const response = await ProductService.updateProduct(id, validatedData, userId);

  res.status(200).json(response);
});


/**
 * Unified endpoint for Related and Recommended products.
 * Returns both in a single request to optimize storefront performance.
 */
export const getProductRelatedInfo = asyncHandler(async (req, res, next) => {
  const {
    parentCategorySlug,
    childCategorySlug,
    categoryId,
    productId // To exclude the current product
  } = req.query;

  const response = await ProductService.getProductRelatedInfo({
    parentCategorySlug,
    childCategorySlug,
    categoryId,
    productId
  });

  res.status(200).json(response);
});

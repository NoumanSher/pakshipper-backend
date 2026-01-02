import mongoose from "mongoose";
import validator from "validator";

const ImageSchema = new mongoose.Schema({
  src: { type: String, required: [true, "Image source is required"] },
  alt: { type: String, required: [true, "Alt text is required for image"] },
  publicId: { type: String }, // Cloudinary public ID for deletion
  blurDataURL: { type: String },
  isThumbnail: { type: Boolean, default: false },
});

const OptionSchema = new mongoose.Schema({
  title: { type: String, required: [true, "Title is required for option"] },
  values: {
    type: [String],
    required: [true, "Values are required for option"],
  },
});

const VariantSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Name is required for variant"] },
  attributes: {
    size: { type: String },
    color: { type: String },
  },
  additionalCostPrice: { type: Number, default: 0 },
  additionalSalePrice: { type: Number, default: 0 },
  stock: {
    type: Number,
    required: [true, "Stock is required for variant"],
    validate: {
      validator: (value) => validator.isInt(value.toString(), { min: 0 }),
      message: "Stock must be an integer greater than or equal to 0",
    },
  },
  image: { type: String },
});

const ProductSchema = new mongoose.Schema(
  {
    productName: { type: String, required: [true, "Product name is required"] },
    parentCategoryID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentCategories",
      required: [true, "Parent category ID is required"],
    },
    childCategoryID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChildCategories",
      // required: [false, "Child category ID is required"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    isVariant: { type: Boolean, default: false },
    salePrice: {
      type: Number,
      required: [true, "Sale price is required"],
      validate: {
        validator: (value) => validator.isNumeric(value.toString()),
        message: "Sale price must be a numeric value",
      },
    },
    rating: { type: Number },
    reveiws: { type: Number },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      validate: {
        validator: (value) => /^[a-zA-Z0-9-]+$/.test(value),
        message: "SKU must be alphanumeric and may include hyphens",
      },
    },
    costPrice: {
      type: Number,
      required: [true, "Cost price is required"],
      validate: {
        validator: (value) => validator.isNumeric(value.toString()),
        message: "Cost price must be a numeric value",
      },
    },
    stock: {
      type: Number,
      required: [true, "Stock count is required"],
      validate: {
        validator: (value) => validator.isInt(value.toString(), { min: 0 }),
        message: "Stock count must be an integer greater than or equal to 0",
      },
    },
    discount: { type: Number, default: 0 },
    isNew: { type: Boolean, default: false },
    isLimited: { type: Boolean, default: false },
    images: { type: [ImageSchema], default: [] },
    options: { type: [OptionSchema], default: [] },
    variants: { type: [VariantSchema], default: [] },
    seo: {
      metaTitle: {
        type: String,
        required: [true, "SEO meta title is required"],
      },
      metaDescription: {
        type: String,
        required: [true, "SEO meta description is required"],
      },
      metaKeywords: {
        type: [String],
        required: [true, "SEO meta keywords are required"],
      },
      slug: {
        type: String,
        required: [true, "SEO slug is required"],
        validate: {
          validator: (value) => validator.isSlug(value),
          message: "Slug must be a valid slug format",
        },
      },
    },
  },
  { timestamps: true }
);

// Add unique index for slug
ProductSchema.index({ "seo.slug": 1 }, { unique: true });

// Add indexes for optimized filtering and sorting
ProductSchema.index({ parentCategoryID: 1 });
ProductSchema.index({ childCategoryID: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ parentCategoryID: 1, createdAt: -1 });
ProductSchema.index({ childCategoryID: 1, createdAt: -1 });

// Pre-save hook to generate slug if not present (simple version)
ProductSchema.pre("save", function (next) {
  if (this.isModified("productName") && !this.seo.slug) {
    this.seo.slug = this.productName
      .toLowerCase()
      .split(" ")
      .join("-")
      .replace(/[^\w-]+/g, "");
  }
  next();
});

export default mongoose.model("Product", ProductSchema);

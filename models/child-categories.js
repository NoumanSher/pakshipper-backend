import mongoose from "mongoose";

const ChildCategoriesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentCategories", // Reference to the ParentCategories schema
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("ChildCategories", ChildCategoriesSchema);

import mongoose from "mongoose";

const ParentCategoriesSchema = new mongoose.Schema(
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
    recommendedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ParentCategories",
      },
    ],
    image: {
      type: String,
      trim: true,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);
export { ParentCategoriesSchema };
export default mongoose.model("ParentCategories", ParentCategoriesSchema);
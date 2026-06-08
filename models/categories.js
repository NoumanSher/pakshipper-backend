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
  },
  { timestamps: true }
);
export { ParentCategoriesSchema };
export default mongoose.model("ParentCategories", ParentCategoriesSchema);
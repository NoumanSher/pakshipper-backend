import mongoose from "mongoose";
import validator from "validator";

const ReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: (value) =>
          validator.isInt(value.toString(), { min: 1, max: 5 }),
        message: "Rating must be an integer between 1 and 5",
      },
    },
    images: {
      type: [String],
      validate: [
        {
          validator: function (arr) {
            return arr.length <= 5;
          },
          message: "You can upload a maximum of 5 images.",
        },
        {
          validator: function (arr) {
            return arr.every((url) => typeof url === "string");
          },
          message: "All images must be string URLs.",
        },
      ],
      default: [],
    },

    description: {
      type: String,
      required: [true, "Review description is required"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    adminResponse: {
      message: { type: String },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      respondedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Index for better query performance
ReviewSchema.index({ productId: 1, status: 1 });
ReviewSchema.index({ userId: 1 });

// Prevent duplicate reviews from same user for same product
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export { ReviewSchema };
export default mongoose.model("Review", ReviewSchema);

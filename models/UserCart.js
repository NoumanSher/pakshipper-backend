import mongoose from "mongoose";

const UserCartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    quantity: {
      type: Number,
      default: 1, // default quantity is 1
      validate: {
        validator: (value) => Number.isInteger(value) && value > 0,
        message: "Quantity must be a positive integer",
      },
    },
  },
  {
    timestamps: true,
  }
);

export { UserCartSchema };
export default mongoose.model("UserCart", UserCartSchema);

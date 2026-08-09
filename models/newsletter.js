import mongoose from "mongoose";
import validator from "validator";

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please provide a valid email address"],
    },
    status: {
      type: String,
      enum: ["subscribed", "unsubscribed"],
      default: "subscribed",
    },
  },
  { timestamps: true }
);

newsletterSchema.index({ email: 1 });

export { newsletterSchema };
export default mongoose.model("Newsletter", newsletterSchema);

import mongoose from "mongoose";
import validator from "validator";

// Define a sub-schema for banner images
const bannerImageSchema = new mongoose.Schema({
    img: { type: String, required: true },
    altText: { type: String, required: true },
    link: { type: String },
    orderNumber: { type: Number, required: true }
});

// Define a sub-schema for promotional cards
const promoCardSchema = new mongoose.Schema({
    img: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    link: { type: String },
    orderNumber: { type: Number, required: true }
});

const settingsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    mobile: { type: String, required: true },
    logo: { type: String, required: true },
    bannerImg: { type: String, required: true },
    bannerImages: { type: [bannerImageSchema], required: true }, // Array of bannerImageSchema
    promoCards: { type: [promoCardSchema], default: [] }, // Array of promo cards
    twitterUrl: { type: String, required: [true, "Link Required"] },
    facebookUrl: { type: String, required: [true, "Link Required"] },
    instagramUrl: { type: String, required: [true, "Link Required"] },
    pinterestUrl: { type: String, required: [true, "Link Required"] },
    youtubeUrl: { type: String, required: [true, "Link Required"] },
    email: {
      type: String,
      required: [true, "Email Required"],
      lowercase: true,
      validate: [validator.isEmail, "Enter Valid Email Address"]
    },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);

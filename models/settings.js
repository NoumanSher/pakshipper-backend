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

// Define sub-schemas for footer links
const footerLinkItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String } // Not required in case it's an action link like "My Account"
});

const footerSectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    items: { type: [footerLinkItemSchema], default: [] }
});

const settingsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    mobile: { type: String, required: true },
    logo: { type: String, required: true },
    bannerImg: { type: String, required: true },
    bannerImgLink: { type: String, default: "" },
    bannerImages: { type: [bannerImageSchema], required: true }, // Array of bannerImageSchema
    promoCards: { type: [promoCardSchema], default: [] }, // Array of promo cards
    footerLinks: { type: [footerSectionSchema], default: [] }, // Array of footer link columns
    twitterUrl: { type: String, required: [true, "Link Required"] },
    facebookUrl: { type: String, required: [true, "Link Required"] },
    instagramUrl: { type: String, required: [true, "Link Required"] },
    pinterestUrl: { type: String, required: [true, "Link Required"] },
    youtubeUrl: { type: String, required: [true, "Link Required"] },
    privacyPolicy: { type: String, default: "" },
    termsOfService: { type: String, default: "" },
    email: {
      type: String,
      required: [true, "Email Required"],
      lowercase: true,
      validate: [validator.isEmail, "Enter Valid Email Address"]
    },
  },
  { timestamps: true }
);

export { settingsSchema };
export default mongoose.model("Settings", settingsSchema);

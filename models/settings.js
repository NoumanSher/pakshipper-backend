import mongoose from "mongoose";
import validator from "validator";

// Define a sub-schema for banner images
const bannerImageSchema = new mongoose.Schema({
    img:         { type: String, required: true },       // Desktop / landscape image
    mobileImg:   { type: String, default: "" },          // Mobile / portrait image
    altText:     { type: String, default: "" },
    link:        { type: String, default: "" },
    title:       { type: String, default: "" },
    subtitle:    { type: String, default: "" },
    buttonText:  { type: String, default: "" },
    buttonLink:  { type: String, default: "" },
    displayText: { type: Boolean, default: false },
    sortOrder:   { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
    orderNumber: { type: Number, default: 0 },           // kept for backward compat
});

// Define a sub-schema for promotional cards
const promoCardSchema = new mongoose.Schema({
    img: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    link: { type: String },
    orderNumber: { type: Number, required: true }
});

// Define a sub-schema for footer links
const footerLinkItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String } // Not required in case it's an action link like "My Account"
});

const footerSectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    items: { type: [footerLinkItemSchema], default: [] }
});

// Sub-schema for About Us page settings
const aboutUsSchema = new mongoose.Schema({
    heroTitle: { type: String, default: "Our Story" },
    heroSubtitle: { type: String, default: "Crafting exceptional experiences" },
    heroImage: { type: String, default: "" },
    storyTitle: { type: String, default: "Our Journey" },
    storyContent: { type: String, default: "" },
    storyImage: { type: String, default: "" },
    stats: {
        type: [
            {
                number: { type: String, required: true },
                label: { type: String, required: true },
            },
        ],
        default: [],
    },
    values: {
        type: [
            {
                title: { type: String, required: true },
                description: { type: String, required: true },
                icon: { type: String, default: "star" },
            },
        ],
        default: [],
    },
});

// Sub-schema for Contact Us page settings
const contactUsSchema = new mongoose.Schema({
    title: { type: String, default: "Get in Touch" },
    subtitle: { type: String, default: "We'd love to hear from you. Reach out anytime!" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    workingHours: { type: String, default: "Mon - Sat: 9:00 AM - 6:00 PM" },
    mapEmbedUrl: { type: String, default: "" },
    enableForm: { type: Boolean, default: true },
});

// Sub-schema for First Order Discount settings
const firstOrderDiscountSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, default: 5 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    title: { type: String, default: "Get 5% OFF On Your First Order" },
    subtitle: { type: String, default: "Sign up and unlock your instant discount." }
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
    shippingAndReturns: { type: String, default: "" },
    aboutUs: { type: aboutUsSchema, default: () => ({}) },
    contactUs: { type: contactUsSchema, default: () => ({}) },
    firstOrderDiscount: { type: firstOrderDiscountSchema, default: () => ({}) },
    email: {
      type: String,
      required: [true, "Email Required"],
      lowercase: true,
      validate: [validator.isEmail, "Enter Valid Email Address"]
    },
    theme: { type: String, default: "default" },
  },
  { timestamps: true }
);

export { settingsSchema };
export default mongoose.model("Settings", settingsSchema);

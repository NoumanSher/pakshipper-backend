import mongoose from "mongoose";
import validator from "validator";

const validatePakistaniMobile = (value) => {
  const pakistaniPhoneRegex = /^\+92\d{10}$/;
  return pakistaniPhoneRegex.test(value);
};
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email Required"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Enter Valid Email Address"],
    },
    username: {
      type: String,
      required: true,
    },
    mobilePhone: {
      type: String, // Correct type for phone numbers with country code
      // required: [true, "Mobile Phone is required"],
      // validate: {
      //   validator: !value || validatePakistaniMobile(value),
      //   message: "Enter a valid mobile number starting with +92",
      // },
      validate: {
        validator: function (value) {
          // Only validate if value exists
          return !value || validatePakistaniMobile(value);
        },
        message: "Enter a valid mobile number starting with +92",
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple users to not have googleId
    },
    linkedinId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple users to not have googleId
    },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    password: {
      type: String,
      required: [true, "Password Required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    confirmPassword: {
      type: String,
      select: false,
    },
    resetToken: {
      type: String,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    firstOrderDiscountUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  this.confirmPassword = undefined;
  next();
});

export { userSchema };
export default mongoose.model("User", userSchema);

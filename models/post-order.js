import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 1,
  },
});

// const Counter = mongoose.model("Counter", counterSchema); // Removed for dynamic compilation

const postOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productName: {
        type: String,
        // Optional for backward compatibility, will be populated for new orders
      },
      productImage: {
        type: String,
        // Snapshot of the thumbnail image
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      lineTotal: {
        type: Number,
        required: true,
      },
    }
    ],

    deliveryFee: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card"],
      required: true,
    },
    orderNo: {
      type: String,
      unique: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      default: null,
    },
    total: {
      type: Number,
      required: true,
    },
    orderStatuses: [{
      status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Requested", "Returned"],
        required: true
      },
      statusDesc: {
        type: String,
        required: true
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Return/Rejection fields
    returnReason: {
      type: String,
      default: null,
    },
    stockRestored: {
      type: Boolean,
      default: false,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      // required: true,
    },
    // Embedded address in PostOrder
    address: {
      firstName: {
        type: String,
        // required: true,
        trim: true,
      },
      lastName: {
        type: String,
        // required: true,
        trim: true,
      },
      streetAddress: {
        type: String,
        // required: true,
        trim: true,
      },
      city: {
        type: String,
        // required: true,
        trim: true,
      },
      zipCode: {
        type: String,
        // required: true,
        trim: true,
      },
      phone: {
        type: String,
        // required: true,
        match: [/^\d{10,15}$/, "Please enter a valid phone number"],
      },
      email: {
        type: String,
        // required: true,
        match: [/.+@.+\..+/, "Please enter a valid email address"],
        lowercase: true,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique order number
postOrderSchema.pre("save", async function (next) {
  if (!this.orderNo) {
    const CounterModel = this.constructor.db.model("Counter");
    const counter = await CounterModel.findOneAndUpdate(
      { key: "orderNo" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderNo = counter.seq.toString().padStart(4, "0"); // Generate padded order number
  }

  // Initialize orderStatuses array if it's empty
  if (!this.orderStatuses || this.orderStatuses.length === 0) {
    this.orderStatuses = [{
      status: "Pending",
      statusDesc: "Order has been placed and is awaiting processing.",
      updatedAt: new Date()
    }];
  }

  next();
});

export { postOrderSchema, counterSchema };
export default mongoose.model("PostOrder", postOrderSchema);

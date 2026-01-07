import PostOrder from "../../models/post-order.js";
import Product from "../../models/products.js";
import Address from "../../models/address.js";
import { sendEmail } from "../../services/email-service.js";
import { orderConfirmationTemplate } from "../../Templates/orderConfirmationTemplate.js";
import { adminOrderNotificationTemplate } from "../../Templates/adminOrderNotificationTemplate.js";
import client from "../../config/redis/redisClient.js";
/**
 * @route POST /api/orders
 * @description Creates a new order with product items, handles stock updates, saves address (if provided), and sends confirmation emails.
 *
 * @param {string} req.body.userId - The ID of the user placing the order.
 * @param {Array} req.body.items - Array of products, each with { productId, variantId, price, quantity }.
 * @param {string} req.body.paymentMethod - Payment method used (e.g., "Cash", "Online").
 * @param {number} req.body.deliveryFee - Delivery fee amount.
 * @param {number} req.body.subTotal - Subtotal of the order (excluding delivery).
 * @param {string} [req.body.addressId] - Optional ID of an existing address to associate.
 * @param {Object} [req.body.address] - Optional new address object (if no addressId is provided).
 * @param {boolean} [req.body.isSaved] - Flag indicating whether to save the new address to the database.
 *
 * @returns {Object} 201 - Order placed successfully with transformed order details.
 * @returns {Object} 400 - Bad request due to missing fields or stock issues.
 * @returns {Object} 404 - Product or address not found.
 * @returns {Object} 500 - Internal server error.
 *
 * @example
 * POST /api/orders
 * {
 *   "userId": "60f5a3a1e1d2c60015b4e9a3",
 *   "items": [
 *     {
 *       "productId": "prod123",
 *       "variantId": "var456",
 *       "price": 100,
 *       "quantity": 2
 *     }
 *   ],
 *   "paymentMethod": "Cash",
 *   "deliveryFee": 20,
 *   "subTotal": 200,
 *   "address": {
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "streetAddress": "123 Main St",
 *     "city": "NYC",
 *     "zipCode": "10001",
 *     "phone": "1234567890",
 *     "email": "john@example.com"
 *   },
 *   "isSaved": true
 * }
 */

export const createPostOrder = async (req, res) => {
  const io = req.app.get("io");
  try {
    const {
      userId,
      items, // Array of products with { productId, variantId, price, quantity }
      paymentMethod,
      deliveryFee,
      subTotal,
      addressId,
      address,
      isSaved,
    } = req.body;

    if (
      !userId ||
      !items ||
      !items.length ||
      !paymentMethod ||
      deliveryFee == null ||
      subTotal == null
    ) {
      return res
        .status(400)
        .json({ message: "Missing required order details." });
    }

    let finalAddressId = null;
    let embeddedAddress = null;

    if (addressId) {
      const existingAddress = await Address.findById(addressId);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found." });
      }
      finalAddressId = addressId;
    } else if (address) {
      if (
        !address.firstName ||
        !address.lastName ||
        !address.streetAddress ||
        !address.city ||
        !address.zipCode ||
        !address.phone ||
        !address.email
      ) {
        return res.status(400).json({ message: "Incomplete address details." });
      }

      const isFirst = !(await Address.exists({ userId }));
      const newAddress = new Address({ ...address, userId, isFirst });
      const savedAddress = await newAddress.save();
      finalAddressId = savedAddress._id;

      if (isSaved) console.log("Address saved for future use");

      embeddedAddress = savedAddress.toObject(); // Store in embedded format
    } else {
      return res.status(400).json({
        message: "Either addressId or address details must be provided.",
      });
    }
    // After resolving addressId / embeddedAddress

    let orderItems = [];
    for (const item of items) {
      const { productId, variantId, price, quantity } = item;
      const product = await Product.findById(productId);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product with ID ${productId} not found.` });
      }

      let selectedVariant = null;
      if (variantId) {
        selectedVariant = product.variants.find(
          (v) => v._id.toString() === variantId.toString()
        );
        if (!selectedVariant) {
          return res.status(404).json({ message: "Variant not found." });
        }
        if (selectedVariant.stock < quantity) {
          return res.status(400).json({
            message: `Insufficient stock for variant: ${selectedVariant.name}`,
          });
        }
        selectedVariant.stock -= quantity; // Deduct stock
      }

      if (!variantId && product.stock < quantity) {
        return res
          .status(400)
          .json({ message: "Insufficient stock for product." });
      }

      product.stock -= quantity; // Deduct product stock
      await product.save();

      orderItems.push({
        productId,
        variantId,
        price,
        quantity,
        lineTotal: price * quantity,
      });
    }

    const totalPrice = subTotal + deliveryFee;

    const postOrder = new PostOrder({
      userId,
      items: orderItems,
      paymentMethod,
      deliveryFee,
      subTotal,
      total: totalPrice,
      addressId: finalAddressId,
      address: embeddedAddress || undefined,
    });
    // console.log(postOrder)
    const savedPostOrder = await postOrder.save();
    const responsePostOrder = await PostOrder.findById(savedPostOrder._id)
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      );
    // if (paymentMethod === "card") {
    //   // Prepare orderMeta for stripe metadata
    //   const orderMeta = {
    //     deliveryFee: deliveryFee.toString(),
    //     subTotal: subTotal.toString(),
    //     address: embeddedAddress
    //       ? `${embeddedAddress.streetAddress}, ${embeddedAddress.city}`
    //       : "Saved Address",
    //     email: embeddedAddress?.email || "guest@example.com",
    //     orderNo: responsePostOrder.orderNo,
    //   };

    //   // Create Stripe Checkout session
    //   const stripeUrl = await createCheckoutSession({
    //     deliveryFee,
    //     items,
    //     userId,
    //     orderMeta,
    //   });

    //   return res.status(200).json({
    //     message: "Redirect to Stripe Checkout",
    //     paymentUrl: stripeUrl,
    //   });
    // }

    // console.log(responsePostOrder);

    const transformedResponse = {
      orderId: responsePostOrder._id,
      user: {
        userId: responsePostOrder.userId?._id,
        username: responsePostOrder.userId?.username || "Deleted User",
        email: responsePostOrder.userId?.email || "N/A",
        phone: responsePostOrder.userId?.mobilePhone || "N/A",
      },
      items: responsePostOrder.items.map((item) => ({
        productId: item.productId._id,
        product: item.productId.productName,
        variant: item.productId.variants?.find(
          (v) => v._id.toString() === item.variantId?.toString()
        ),

        price: item.price,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      orderDetails: {
        totalPrice: responsePostOrder.total,
        subTotal: responsePostOrder.subTotal,
        paymentMethod: responsePostOrder.paymentMethod,
        paymentStatus: responsePostOrder.paymentStatus,
        deliveryFee: responsePostOrder.deliveryFee,
      },
      address: responsePostOrder.addressId || responsePostOrder.address,
      orderNo: responsePostOrder.orderNo,
      orderStatuses: responsePostOrder.orderStatuses,
      formattedDate: responsePostOrder.createdAt
        ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(responsePostOrder.createdAt))
        : "N/A",
    };
    // console.log(transformedResponse)
    const { html, subject, text } = orderConfirmationTemplate(
      responsePostOrder,
      transformedResponse
    );
    const {
      html: html1,
      subject: adminSubject,
      text: adminText,
    } = adminOrderNotificationTemplate(responsePostOrder, transformedResponse);
    // // Send emails
    // // console.log(responsePostOrder.userId.email)
    await sendEmail(responsePostOrder.userId.email, subject, text, html);
    await sendEmail(process.env.EMAIL_USER, adminSubject, adminText, html1);
    await sendEmail("nk104626@gmail.com", adminSubject, adminText, html1);
    await client.flushAll();

    res.status(201).json({
      message: "Order placed successfully!",
      data: transformedResponse,
    });
    io.to("admins").emit("newOrder", {
      message: "A new order has been placed!",
      orderId: transformedResponse.orderId,
      user: transformedResponse.user.userId,
    });
    console.log("🚨 Emitting to admins...");
  } catch (error) {
    res.status(500).json({ message: "Order Failed.", error });
  }
};
/**
 * @route UserAllOrder
 * @route GET /api/orders/user/:userId
 * @description Fetches all orders placed by a specific user, including populated user, product, and address details.
 *
 * @param {string} req.params.userId - The ID of the user whose orders are to be retrieved.
 *
 * @returns {Object} 200 - Success response with transformed order data for the user.
 * @returns {Object} 500 - Internal server error if something goes wrong during data retrieval.
 *
 * @example
 * GET /api/orders/user/60f5a3a1e1d2c60015b4e9a3
 *
 * Response:
 * {
 *   "message": "Order Fetch Successfully!",
 *   "data": [
 *     {
 *       "orderId": "12345",
 *       "user": {
 *         "username": "john_doe",
 *         "email": "john@example.com",
 *         "phone": "1234567890"
 *       },
 *       "items": [
 *         {
 *           "productId": "prod001",
 *           "product": "Phone",
 *           "variant": { "_id": "var001", "color": "Black" },
 *           "price": 299,
 *           "quantity": 1,
 *           "lineTotal": 299
 *         }
 *       ],
 *       "orderDetails": {
 *         "totalPrice": 349,
 *         "subTotal": 299,
 *         "paymentMethod": "Cash",
 *         "paymentStatus": "Pending",
 *         "deliveryFee": 50
 *       },
 *       "address": {
 *         "firstName": "John",
 *         "city": "New York",
 *         ...
 *       },
 *       "orderNo": "ORD2025001",
 *       "orderStatuses": [...],
 *       "createdAt": "Tuesday, Jun 04, 2025"
 *     }
 *   ]
 * }
 */

export const userAllOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);
    const userOrders = await PostOrder.find({ userId })
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      )
      .sort({ createdAt: -1 });
    console.log(userOrders);
    const transformedResponse = userOrders.map((order) => ({
      orderId: order._id,
      user: {
        username: order.userId?.username || "Deleted User",
        email: order.userId?.email || "N/A",
        phone: order.userId?.mobilePhone || "N/A",
      },
      items: order.items.map((item) => ({
        productId: item.productId._id,
        product: item.productId.productName,
        variant: item.productId.variants?.find(
          (v) => v._id.toString() === item.variantId?.toString()
        ),

        price: item.price,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      orderDetails: {
        totalPrice: order.total,
        subTotal: order.subTotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryFee: order.deliveryFee,
      },
      address: order.addressId || order.address,
      orderNo: order.orderNo,
      orderStatuses: order.orderStatuses,
      createdAt: new Intl.DateTimeFormat("en-US", {
        weekday: "long", // Include the name of the day
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(order.createdAt)), // Format date
    }));

    res.status(200).json({
      message: "Order Fetch Successfully!",
      // data1: userOrders,
      data: transformedResponse,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed Fetching", error });
  }
};
/**
 * @function AllOrders
 * @description Retrieves all orders from the database with user, product, and address details populated.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 *
 * @returns {Object} 200 - Returns an array of transformed order data.
 * @returns {Object} 500 - Returns an error message if fetching fails.
 *
 * @example
 * GET /api/orders/all
 *
 * Response:
 * {
 *   "message": "Order Fetch Successfully!",
 *   "data": [
 *     {
 *       "orderId": "order123",
 *       "user": {
 *         "username": "john_doe",
 *         "email": "john@example.com",
 *         "phone": "1234567890"
 *       },
 *       "items": [
 *         {
 *           "productId": "prod001",
 *           "product": "Smartphone X",
 *           "variant": { "_id": "var123", "color": "Black" },
 *           "price": 499,
 *           "quantity": 2,
 *           "lineTotal": 998
 *         }
 *       ],
 *       "totalPrice": 1098,
 *       "subTotal": 998,
 *       "paymentMethod": "Card",
 *       "paymentStatus": "Paid",
 *       "deliveryFee": 100,
 *       "address": { "firstName": "John", "city": "NYC", ... },
 *       "orderNo": "ORD123456",
 *       "orderStatuses": [
 *         {
 *           "status": "Delivered",
 *           "statusDesc": "Package delivered successfully.",
 *           "updatedAt": "2024-06-01T10:00:00Z"
 *         }
 *       ],
 *       "formattedDate": "Monday, Jun 03, 2024"
 *     }
 *   ]
 * }
 */

export const AllOrders = async (req, res) => {
  try {
    const userOrders = await PostOrder.find()
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      )
      .sort({ createdAt: -1 });

    const transformedResponse = userOrders.map((order) => ({
      orderId: order._id,
      user: {
        username: order.userId?.username || "Deleted User",
        email: order.userId?.email || "N/A",
        phone: order.userId?.mobilePhone || "N/A",
      },
      items: order.items.map((item) => ({
        productId: item.productId._id,
        product: item.productId.productName,
        variant: item.productId.variants?.find(
          (v) => v._id.toString() === item.variantId?.toString()
        ),
        price: item.price,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      totalPrice: order.totalPrice,
      subTotal: order.subTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryFee: order.deliveryFee,
      address: order.addressId,
      orderNo: order.orderNo,
      orderStatuses: order.orderStatuses,
      formattedDate: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(order.createdAt)),
    }));

    res.status(200).json({
      message: "Order Fetch Successfully!",
      data: transformedResponse,
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Failed Fetching", error });
  }
};

/**
 * @function searchOrderNoOrders
 * @description Retrieves a specific order by order number and returns detailed order information.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.orderNo - Unique order number to search the order.
 *
 * @param {Object} res - Express response object.
 *
 * @returns {Object} 200 - Returns transformed order data if found.
 * @returns {Object} 404 - If no order is found with the given order number.
 * @returns {Object} 500 - On server error during query or transformation.
 *
 * @example
 * GET /api/orders/search/ORD123456
 *
 * Response:
 * {
 *   "message": "Order Fetch Successfully!",
 *   "data": {
 *     "orderId": "abc123",
 *     "user": {
 *       "username": "john_doe",
 *       "email": "john@example.com",
 *       "phone": "1234567890"
 *     },
 *     "items": [
 *       {
 *         "productId": "prod001",
 *         "product": "Smartphone X",
 *         "variant": { "_id": "var123", "color": "Black", "storage": "128GB" },
 *         "price": 499,
 *         "quantity": 2,
 *         "lineTotal": 998
 *       }
 *     ],
 *     "totalPrice": 1098,
 *     "subTotal": 998,
 *     "paymentMethod": "Card",
 *     "paymentStatus": "Paid",
 *     "deliveryFee": 100,
 *     "address": {
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       ...
 *     },
 *     "orderNo": "ORD123456",
 *     "orderStatuses": [
 *       {
 *         "status": "Processing",
 *         "statusDesc": "Your order is being prepared.",
 *         "updatedAt": "2024-06-01T10:00:00Z"
 *       }
 *     ],
 *     "createdAt": "Monday, Jun 03, 2024"
 *   }
 * }
 */

export const searchOrderNoOrders = async (req, res) => {
  try {
    const { orderNo } = req.params;

    const orderNoOrder = await PostOrder.findOne({ orderNo })
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      );

    if (!orderNoOrder) {
      return res.status(404).json({ message: "Order Not Found" });
    }

    const transformedResponse = {
      orderId: orderNoOrder._id,
      user: {
        username: orderNoOrder.userId?.username || "Deleted User",
        email: orderNoOrder.userId?.email || "N/A",
        phone: orderNoOrder.userId?.mobilePhone || "N/A",
      },
      items: orderNoOrder.items.map((item) => {
        const variant = item.productId.variants?.find(
          (v) => v._id.toString() === item.variantId?.toString()
        );
        return {
          productId: item.productId._id,
          product: item.productId.productName,
          variant,
          price: item.price,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        };
      }),
      totalPrice: orderNoOrder.totalPrice,
      subTotal: orderNoOrder.subTotal,
      paymentMethod: orderNoOrder.paymentMethod,
      paymentStatus: orderNoOrder.paymentStatus,
      deliveryFee: orderNoOrder.deliveryFee,
      address: orderNoOrder.addressId,
      orderNo: orderNoOrder.orderNo,
      orderStatuses: orderNoOrder.orderStatuses,
      createdAt: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(orderNoOrder.createdAt)),
    };

    res.status(200).json({
      message: "Order Fetch Successfully!",
      data: transformedResponse,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed Fetching", error });
  }
};

/**
 * @function userAddress
 * @description Fetches the default address (`isFirst: true`) for a given user.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.params - URL parameters.
 * @param {string} req.params.userId - The ID of the user whose address is to be fetched.
 *
 * @param {Object} res - Express response object.
 *
 * @returns {Object} 200 - Success response with the default address.
 * @returns {Object} 404 - If no default address is found for the user.
 * @returns {Object} 500 - On any internal server error.
 *
 * @example
 * GET /api/user/address/12345
 *
 * Response:
 * {
 *   "message": "Address fetched successfully!",
 *   "address": {
 *     "_id": "abc123",
 *     "userId": "12345",
 *     "street": "123 Main St",
 *     "city": "Example City",
 *     "isFirst": true
 *   }
 * }
 */

export const userAddress = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the address with isFirst: true
    const userAddress = await Address.findOne({ userId, isFirst: true });

    if (!userAddress) {
      return res
        .status(404)
        .json({ message: "Address with isFirst: true not found." });
    }

    res.status(200).json({
      message: "Address fetched successfully!",
      address: userAddress,
    });
  } catch (error) {
    res.status(500).json({ message: "Error occurred", error });
  }
};

/**
 * @function orderStatusUpdate
 * @description Updates the status history of an order by adding a new status entry.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.orderNo - The unique order number to identify the order
 * @param {string} req.body.status - The new status to add (e.g., "Shipped", "Delivered")
 * @param {string} req.body.statusDesc - Optional description or note about the status update
 *
 * @param {Object} res - Express response object
 *
 * @returns {Object} 200 - Success response with updated status history
 * @returns {Object} 404 - If no order is found with the given order number
 * @returns {Object} 500 - Internal server error
 *
 * @example
 * POST /api/orders/update-status
 * Request body:
 * {
 *   "orderNo": "ORD12345",
 *   "status": "Shipped",
 *   "statusDesc": "Order handed over to courier"
 * }
 *
 * Response:
 * {
 *   "message": "Order status updated successfully",
 *   "orderStatuses": [
 *     {
 *       "status": "Processing",
 *       "statusDesc": "Order confirmed",
 *       "updatedAt": "2025-06-03T10:00:00.000Z"
 *     },
 *     {
 *       "status": "Shipped",
 *       "statusDesc": "Order handed over to courier",
 *       "updatedAt": "2025-06-04T12:34:56.000Z"
 *     }
 *   ]
 * }
 */

export const orderStatusUpdate = async (req, res) => {
  try {
    const { orderNo, status, statusDesc } = req.body;

    // Find the order by order number
    const order = await PostOrder.findOne({ orderNo }).populate("userId");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Add the new status to the orderStatuses array
    order.orderStatuses.push({
      status,
      statusDesc,
      updatedAt: new Date(),
    });

    // Save the updated order
    await order.save();

    return res.status(200).json({
      message: "Order status updated successfully",
      orderStatuses: order.orderStatuses,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error occurred", error });
  }
};

/**
 * @function deletePostOrder
 * @description Deletes a single order by ID.
 * @access Admin
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - The ID of the order to delete
 *
 * @param {Object} res - Express response object
 *
 * @returns {Object} 200 - Success message
 * @returns {Object} 404 - Order not found
 * @returns {Object} 500 - Internal server error
 */
export const deletePostOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await PostOrder.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete order", error });
  }
};

/**
 * @function bulkDeletePostOrders
 * @description Deletes multiple orders by their IDs.
 * @access Admin
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array<string>} req.body.ids - Array of order IDs to delete
 *
 * @param {Object} res - Express response object
 *
 * @returns {Object} 200 - Success message with count of deleted orders
 * @returns {Object} 400 - IDs missing or invalid format
 * @returns {Object} 500 - Internal server error
 */
export const bulkDeletePostOrders = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No order IDs provided for deletion" });
    }

    const result = await PostOrder.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      message: `${result.deletedCount} orders deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete orders", error });
  }
};

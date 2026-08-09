import { createEmailService } from "./emailFactory.js";
import { orderConfirmationTemplate } from "../Templates/orderConfirmationTemplate.js";
import { adminOrderNotificationTemplate } from "../Templates/adminOrderNotificationTemplate.js";
import { orderStatusUpdateTemplate } from "../Templates/orderStatusUpdateTemplate.js";
import { flushTenantCache } from "../config/redis/redisHelpers.js";
import AppError from "../utils/AppError.js";

class OrderService {
  /**
   * Creates a new order.
   */
  static async createOrder(models, tenantConfig, orderData, io) {
    const { PostOrder, Product, Address, User } = models;
    const {
      userId,
      items,
      paymentMethod,
      deliveryFee,
      subTotal,
      addressId,
      address,
      isSaved,
    } = orderData;

    let finalAddressId = null;
    let embeddedAddress = null;

    if (addressId) {
      const existingAddress = await Address.findById(addressId);
      if (!existingAddress) throw new AppError("Address not found.", 404);
      finalAddressId = addressId;
    } else if (address) {
      const isFirst = !(await Address.exists({ userId }));
      const newAddress = new Address({ ...address, userId, isFirst });
      const savedAddress = await newAddress.save();
      finalAddressId = savedAddress._id;
      embeddedAddress = savedAddress.toObject();
    } else {
      throw new AppError("Either addressId or address details must be provided.", 400);
    }

    let orderItems = [];
    for (const item of items) {
      const { productId, variantId, price, quantity } = item;
      const product = await Product.findById(productId);
      if (!product) throw new AppError(`Product with ID ${productId} not found.`, 404);

      if (variantId) {
        const selectedVariant = product.variants.find(
          (v) => v._id.toString() === variantId.toString()
        );
        if (!selectedVariant) throw new AppError("Variant not found.", 404);
        if (selectedVariant.stock < quantity) {
          throw new AppError(`Insufficient stock for variant: ${selectedVariant.name}`, 400);
        }
        selectedVariant.stock -= quantity;
      } else if (product.stock < quantity) {
        throw new AppError("Insufficient stock for product.", 400);
      }

      product.stock -= quantity;
      await product.save();

      orderItems.push({
        productId,
        productName: product.productName,
        productImage: product.images?.[0]?.src || null,
        variantId,
        price,
        quantity,
        lineTotal: price * quantity,
      });
    }

    const totalPrice = subTotal + deliveryFee;

    // --- First-order discount (5%) ---
    let discountAmount = 0;
    let discountType = null;
    const user = await User.findById(userId);
    if (user && !user.firstOrderDiscountUsed) {
      discountAmount = Math.round(subTotal * 0.05);
      discountType = "FIRST_ORDER";
    }
    const finalTotal = totalPrice - discountAmount;

    const postOrder = new PostOrder({
      userId,
      items: orderItems,
      paymentMethod,
      deliveryFee,
      subTotal,
      discountAmount,
      discountType,
      total: finalTotal,
      addressId: finalAddressId,
      address: embeddedAddress || undefined,
    });

    const savedPostOrder = await postOrder.save();

    // Mark first-order discount as used if applied
    if (discountAmount > 0 && user) {
      await User.findByIdAndUpdate(userId, { firstOrderDiscountUsed: true });
    }
    const responsePostOrder = await PostOrder.findById(savedPostOrder._id)
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      );

    const transformedResponse = this._transformOrderResponse(responsePostOrder);

    // Send emails (non-blocking — order succeeds even if email is not configured)
    const { html, subject, text } = orderConfirmationTemplate(responsePostOrder, transformedResponse);
    const { html: html1, subject: adminSubject, text: adminText } = adminOrderNotificationTemplate(responsePostOrder, transformedResponse);

    try {
      const emailService = createEmailService(tenantConfig.email);
      await Promise.all([
        emailService.sendEmail(responsePostOrder.userId.email, subject, text, html),
        emailService.sendEmail(tenantConfig.email.user, adminSubject, adminText, html1),
      ]);
    } catch (emailErr) {
      console.warn('[OrderService] Order confirmation email skipped:', emailErr.message);
    }

    await flushTenantCache(tenantConfig.tenantId);

    if (io) {
      io.to(`${tenantConfig.tenantId}:admins`).emit("newOrder", {
        message: "A new order has been placed!",
        orderId: transformedResponse.orderId,
        orderNo: transformedResponse.orderNo,
        user: transformedResponse.user.userId,
      });
    }

    return transformedResponse;
  }

  /**
   * Fetches all orders for a user.
   */
  static async getUserOrders(models, userId) {
    const { PostOrder } = models;
    const userOrders = await PostOrder.find({ userId })
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      )
      .sort({ createdAt: -1 });

    return userOrders.map(order => this._transformOrderResponse(order));
  }

  /**
   * Fetches all orders.
   */
  static async getAllOrders(models) {
    const { PostOrder } = models;
    const userOrders = await PostOrder.find()
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      )
      .sort({ createdAt: -1 });

    return userOrders.map(order => this._transformOrderResponse(order));
  }

  /**
   * Searches for an order by order number.
   */
  static async getOrderByNo(models, orderNo) {
    const { PostOrder } = models;
    const order = await PostOrder.findOne({ orderNo })
      .populate("userId", "username email mobilePhone")
      .populate("items.productId", "productName variants")
      .populate(
        "addressId",
        "firstName lastName streetAddress city zipCode phone email isFirst"
      );

    if (!order) throw new AppError("Order Not Found", 404);

    return this._transformOrderResponse(order);
  }

  /**
   * Updates order status.
   */
  static async updateOrderStatus(models, tenantConfig, orderNo, status, statusDesc, io) {
    const { PostOrder, Notification } = models;
    const order = await PostOrder.findOne({ orderNo }).populate("userId");
    if (!order) throw new AppError("Order not found", 404);

    order.orderStatuses.push({
      status,
      statusDesc,
      updatedAt: new Date(),
    });

    await order.save();

    if (order.userId && order.userId.email) {
      try {
        const { subject, text, html } = orderStatusUpdateTemplate(order, { status, statusDesc });
        const emailService = createEmailService(tenantConfig.email);
        await emailService.sendEmail(order.userId.email, subject, text, html);
      } catch (emailErr) {
        console.warn('[OrderService] Status update email skipped:', emailErr.message);
      }
    }

    // Save notification to database
    if (order.userId) {
      await Notification.create({
        userId: order.userId._id,
        title: "Order Update",
        message: `Your order #${order.orderNo} is now ${status}!`,
        type: "ORDER_UPDATE",
        metadata: {
          orderNo: order.orderNo,
          link: `/profile/order-details?orderId=${order.orderNo}`,
        },
      });
    }

    // Emit real-time notification to the user
    if (io && order.userId) {
      io.to(`${tenantConfig.tenantId}:user_${order.userId._id}`).emit("orderStatusUpdated", {
        orderNo: order.orderNo,
        status: status,
        statusDesc: statusDesc,
        message: `Your order #${order.orderNo} is now ${status}!`,
        link: `/profile/order-details?orderId=${order.orderNo}`,
      });
    }

    return order.orderStatuses;
  }

  /**
   * Marks an order as returned, restores stock, notifies the customer.
   */
  static async markAsReturned(models, tenantConfig, orderNo, returnReason, io) {
    const { PostOrder, Product, Notification } = models;
    const order = await PostOrder.findOne({ orderNo })
      .populate("userId")
      .populate("items.productId");
    if (!order) throw new AppError("Order not found", 404);

    const currentStatus = order.orderStatuses[order.orderStatuses.length - 1]?.status;
    const allowedStatuses = ["Shipped", "Delivered", "Return Requested"];
    if (!allowedStatuses.includes(currentStatus)) {
      throw new AppError(
        `Cannot mark as returned. Current status is "${currentStatus}". Only Shipped or Delivered orders can be returned.`,
        400
      );
    }

    // Push both status entries
    if (currentStatus !== "Return Requested") {
      order.orderStatuses.push({
        status: "Return Requested",
        statusDesc: "Customer rejected or returned the parcel.",
        updatedAt: new Date(),
      });
    }
    order.orderStatuses.push({
      status: "Returned",
      statusDesc: `Item returned. Reason: ${returnReason}`,
      updatedAt: new Date(),
    });

    order.returnReason = returnReason;

    // Restore stock only once
    const restoredProductIds = [];
    if (!order.stockRestored) {
      for (const item of order.items) {
        const product = await Product.findById(
          item.productId?._id || item.productId
        );
        if (!product) continue;

        if (item.variantId) {
          const variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
          if (variant) variant.stock += item.quantity;
        }
        product.stock += item.quantity;
        await product.save();
        restoredProductIds.push(product._id.toString());
      }
      order.stockRestored = true;
    }

    await order.save();

    // Send email (non-blocking)
    if (order.userId?.email) {
      try {
        const { subject, text, html } = orderStatusUpdateTemplate(order, {
          status: "Returned",
          statusDesc: `Your return has been processed. Reason: ${returnReason}`,
        });
        const emailService = createEmailService(tenantConfig.email);
        await emailService.sendEmail(order.userId.email, subject, text, html);
      } catch (emailErr) {
        console.warn('[OrderService] Return notification email skipped:', emailErr.message);
      }
    }

    // Save in-app notification
    if (order.userId) {
      await Notification.create({
        userId: order.userId._id,
        title: "Order Returned",
        message: `Your order #${order.orderNo} has been marked as returned.`,
        type: "ORDER_UPDATE",
        metadata: {
          orderNo: order.orderNo,
          link: `/profile/order-details?orderId=${order.orderNo}`,
        },
      });
    }

    // Real-time socket notification
    if (io && order.userId) {
      io.to(`${tenantConfig.tenantId}:user_${order.userId._id}`).emit("orderStatusUpdated", {
        orderNo: order.orderNo,
        status: "Returned",
        statusDesc: `Your return has been processed. Reason: ${returnReason}`,
        message: `Your order #${order.orderNo} has been marked as returned.`,
        link: `/profile/order-details?orderId=${order.orderNo}`,
      });
    }

    await flushTenantCache(tenantConfig.tenantId);

    // Broadcast to this tenant's storefront visitors so their product cache
    // is invalidated immediately — not just the order owner.
    if (io && restoredProductIds.length > 0) {
      io.to(`${tenantConfig.tenantId}:public`).emit("stockRestored", { productIds: restoredProductIds });
    }

    return order.orderStatuses;
  }

  /**
   * Deletes an order.
   */
  static async deleteOrder(models, id) {
    const { PostOrder } = models;
    const deletedOrder = await PostOrder.findByIdAndDelete(id);
    if (!deletedOrder) throw new AppError("Order not found", 404);
    return true;
  }

  /**
   * Fetches the default address for a user.
   */
  static async getUserDefaultAddress(models, userId) {
    const { Address } = models;
    const userAddress = await Address.findOne({ userId, isFirst: true });
    if (!userAddress) throw new AppError("Address with isFirst: true not found.", 404);
    return userAddress;
  }

  /**
   * Bulk deletes orders.
   */
  static async bulkDeleteOrders(models, ids) {
    const { PostOrder } = models;
    const result = await PostOrder.deleteMany({ _id: { $in: ids } });
    if (result.deletedCount === 0) throw new AppError("No orders found to delete.", 404);
    return result.deletedCount;
  }

  /**
   * Helper to transform order response.
   */
  static _transformOrderResponse(order) {
    return {
      orderId: order._id,
      user: {
        userId: order.userId?._id,
        username: order.userId?.username || "Deleted User",
        email: order.userId?.email || "N/A",
        phone: order.userId?.mobilePhone || "N/A",
      },
      items: order.items.map((item) => ({
        productId: item.productId?._id || item.productId,
        product: item.productName || item.productId?.productName || "Deleted Product",
        variant: item.productId?.variants?.find(
          (v) => v._id.toString() === item.variantId?.toString()
        ) || (item.variantId ? { _id: item.variantId, name: "Unknown Variant" } : null),
        price: item.price,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        image: item.productImage || (item.productId?.images && item.productId.images[0]?.src) || null,
      })),
      orderDetails: {
        totalPrice: order.total || order.totalPrice,
        subTotal: order.subTotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryFee: order.deliveryFee,
        discountAmount: order.discountAmount || 0,
        discountType: order.discountType || null,
      },
      subTotal: order.subTotal,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryFee: order.deliveryFee,
      discountAmount: order.discountAmount || 0,
      totalPrice: order.total || order.totalPrice,
      address: order.addressId || order.address,
      orderNo: order.orderNo,
      orderStatuses: order.orderStatuses,
      returnReason: order.returnReason || null,
      stockRestored: order.stockRestored || false,
      createdAt: order.createdAt
        ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(order.createdAt))
        : "N/A",
      formattedDate: order.createdAt
        ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(order.createdAt))
        : "N/A",
    };
  }
}

export default OrderService;

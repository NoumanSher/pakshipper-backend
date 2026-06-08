import { getPlatformConnection } from "../../config/platformConnection.js";
import { getTenantConnection } from "../../config/connectionPool.js";
import { getTenantModels } from "../../models/registry.js";
import { decrypt } from "../../utils/encryption.js";
import { getStripeInstance } from "../../services/stripeFactory.js";
import { createEmailService } from "../../services/emailFactory.js";
import { flushTenantCache } from "../../config/redis/redisHelpers.js";
import { orderConfirmationTemplate } from "../../Templates/orderConfirmationTemplate.js";
import { adminOrderNotificationTemplate } from "../../Templates/adminOrderNotificationTemplate.js";

/**
 * Decrypts sensitive fields in the tenant configuration.
 */
const getDecryptedConfig = (config) => {
  const decrypted = JSON.parse(JSON.stringify(config)); // Deep copy

  if (decrypted.stripe) {
    if (decrypted.stripe.secretKey) decrypted.stripe.secretKey = decrypt(decrypted.stripe.secretKey);
    if (decrypted.stripe.webhookSecret) decrypted.stripe.webhookSecret = decrypt(decrypted.stripe.webhookSecret);
  }
  
  if (decrypted.email && decrypted.email.pass) {
    decrypted.email.pass = decrypt(decrypted.email.pass);
  }

  return decrypted;
};

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  // 1. Resolve tenantId from URL params, query params, or the event metadata
  let tenantId = req.params.tenantId || req.query.tenantId;
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
    const stripeObj = payload.data?.object;
    if (!tenantId) {
      tenantId = stripeObj?.metadata?.tenantId || stripeObj?.client_reference_id;
    }
  } catch (err) {
    console.error("Failed to parse Stripe webhook raw body:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!tenantId) {
    console.error("⚠️ Stripe webhook received but no tenantId could be resolved.");
    return res.status(400).send("Webhook Error: Tenant ID not found in metadata or URL");
  }

  try {
    // 2. Fetch tenant config from platform database
    const platformConn = getPlatformConnection();
    const TenantModel = platformConn.model("Tenant");
    const tenant = await TenantModel.findById(tenantId).lean();

    if (!tenant) {
      console.error(`⚠️ Tenant ${tenantId} not found for Stripe webhook.`);
      return res.status(404).send("Tenant not found");
    }

    if (tenant.status !== "active") {
      console.error(`⚠️ Tenant ${tenantId} is not active (status: ${tenant.status}).`);
      return res.status(403).send("Tenant is not active");
    }

    // 3. Decrypt configuration and connect to tenant database
    const tenantConfig = getDecryptedConfig(tenant.config || {});
    tenantConfig.tenantId = tenant._id.toString();
    tenantConfig.slug = tenant.slug;
    tenantConfig.name = tenant.name;

    const dbConnectionString = decrypt(tenant.database.connectionString);
    const tenantDb = await getTenantConnection(tenant._id.toString(), dbConnectionString);
    const models = getTenantModels(tenantDb);

    const stripe = getStripeInstance(tenantConfig);
    const endpointSecret = tenantConfig.stripe?.webhookSecret;

    if (!endpointSecret) {
      console.error(`⚠️ Stripe webhook secret not configured for tenant ${tenantId}`);
      return res.status(400).send("Stripe webhook secret not configured");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed for tenant ${tenantId}.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;

        try {
          const userId = session.metadata.userId;
          const orderNo = session.metadata.orderNo;

          const { PostOrder } = models;

          // Find order by orderNo or userId
          const order = await PostOrder.findOne({ userId, orderNo });

          if (!order) {
            console.log("Order not found for Stripe session.");
            return res.status(404).send("Order not found");
          }

          // Update order payment status
          order.paymentStatus = "Paid";
          order.paymentIntentId = session.payment_intent;
          await order.save();

          const responsePostOrder = await PostOrder
            .findById(order._id)
            .populate("userId", "username email mobilePhone")
            .populate("items.productId", "productName variants")
            .populate(
              "addressId",
              "firstName lastName streetAddress city zipCode phone email isFirst"
            );

          const transformedResponse = {
            orderId: responsePostOrder._id,
            user: {
              userId: responsePostOrder.userId._id,
              username: responsePostOrder.userId.username,
              email: responsePostOrder.userId.email,
              phone: responsePostOrder.userId.mobilePhone,
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

          const { html, subject, text } = orderConfirmationTemplate(
            responsePostOrder,
            transformedResponse
          );
          const {
            html: html1,
            subject: adminSubject,
            text: adminText,
          } = adminOrderNotificationTemplate(
            responsePostOrder,
            transformedResponse
          );

          // Send emails using dynamic email service and flush cache
          const emailService = createEmailService(tenantConfig.email);
          await Promise.all([
            emailService.sendEmail(responsePostOrder.userId.email, subject, text, html),
            emailService.sendEmail(tenantConfig.email.user, adminSubject, adminText, html1),
            flushTenantCache(tenantId)
          ]);

          console.log(`Order ${order._id} marked as paid for tenant ${tenantId}.`);
        } catch (error) {
          console.error("Error updating order after payment:", error);
          return res.status(500).send("Server error");
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type} for tenant ${tenantId}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Processing Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

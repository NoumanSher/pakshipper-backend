import Stripe from "stripe";
import postOrder from "../../models/post-order.js";
import { orderConfirmationTemplate } from "../../Templates/orderConfirmationTemplate.js";
import { adminOrderNotificationTemplate } from "../../Templates/adminOrderNotificationTemplate.js";
import { sendEmail } from "../../services/email-service.js";
import client from "../../config/redis/redisClient.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // from Stripe dashboard

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;

      try {
        // Find the order using userId or metadata stored in the session
        // Assume you stored orderId or userId in metadata at checkout creation
        const userId = session.metadata.userId;
        const orderNo = session.metadata.orderNo;


        // Find order by orderNo or userId (depending on what you saved)
        const order = await postOrder.findOne({ userId, orderNo });

        if (!order) {
          console.log("Order not found for Stripe session.");
          return res.status(404).send("Order not found");
        }

        // Update order payment status
        order.paymentStatus = "Paid"; // or "Completed"
        order.paymentIntentId = session.payment_intent; // Save payment intent ID if you want
        await order.save();
        const responsePostOrder = await postOrder
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
        // console.log(transformedResponse)
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
        // // Send emails
        // // console.log(responsePostOrder.userId.email)
        await sendEmail(responsePostOrder.userId.email, subject, text, html);
        await sendEmail(process.env.EMAIL_USER, adminSubject, adminText, html1);
        await sendEmail("pakshipperstore@gmail.com", adminSubject, adminText, html1);
        await client.flushAll();

        console.log(`Order ${order._id} marked as paid.`);
      } catch (error) {
        console.error("Error updating order after payment:", error);
        return res.status(500).send("Server error");
      }

      break;

    // handle other event types if needed
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
};

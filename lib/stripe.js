// stripe/createCheckoutSession.js
import Stripe from "stripe";
import products from "../models/products.js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ||
    "sk_test_51OUleQIj4ufHiU6P0yo18678Cafttf8HSfZDtVNCStulTI1N7pxHhGjK1ib6846asePjt2rmOCNIh1w7NRwKSMCP001R50yQNd"
);

/**
 * Create a Stripe checkout session.
 * @param {Object} options - Options including lineItems, successUrl, and cancelUrl.
 * @returns {Promise<string>} - The checkout session URL.
 */
export const createCheckoutSession = async ({
  deliveryFee,
  items,
  userId,
  orderMeta,
}) => {
  const line_items = [];

  for (const item of items) {
    const { productId, variantId, price, quantity } = item;

    const product = await products.findById(productId).lean();
    if (!product) throw new Error("Product not found");

    let variant = null;
    if (variantId) {
      variant = product.variants?.find((v) => v._id.toString() === variantId);
    }

    const productName = product.productName || "Product";
    const sku = variant?.sku || product.sku || "N/A";
    const thumbnailImage = product.images?.find((img) => img.isThumbnail)?.src;
    const fallbackImage = product.images?.[0]?.src;
    const image =
      variant?.image || thumbnailImage || fallbackImage || undefined;

    line_items.push({
      price_data: {
        currency: "pkr",
        product_data: {
          name: productName,
          //   description,
          images: image ? [image] : undefined,
          metadata: {
            sku,
            productId,
            ...(variantId && { variantId }),
          },
        },
        unit_amount: price * 100, // in paisa
      },
      quantity,
    });
  }

  line_items.push({
    price_data: {
      currency: "pkr",
      product_data: {
        name: "🚚 Delivery Fee",
        description: "Charged separately for shipping",
      },
      unit_amount: deliveryFee * 100,
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: orderMeta.email,
    metadata: {
      userId,
      ...orderMeta,
    },
    line_items,
    success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/checkout`,
  });

  return session.url;
};

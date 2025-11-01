export const adminOrderNotificationTemplate = (
  responsePostOrder,
  transformedResponse
) => {
  const adminEmail = process.env.EMAIL_USER; // Store owner's email from .env
  const subject = "New Order Received - Order Details";

  const text = `Dear Store Owner,

A new order has been placed. Here are the details:

Order Number: ${responsePostOrder.orderNo}
Order Date: ${transformedResponse.formattedDate}
Customer Name: ${responsePostOrder.userId?.username || "N/A"}
Customer Email: ${responsePostOrder.userId?.email || "N/A"}
Customer Phone: ${responsePostOrder.userId?.mobilePhone || "N/A"}

Items Ordered:
${responsePostOrder.items
  .map(
    (item, index) =>
      `${index + 1}. ${item.productId?.productName || "Unknown Product"} ${
        item.variant ? `(Variant: ${item.variant.variantName})` : ""
      }\n   Quantity: ${item.quantity}, Price: PKR ${item.price}, Line Total: PKR ${
        item.lineTotal
      }`
  )
  .join("\n")}

Subtotal: $${transformedResponse.orderDetails.subTotal}
Delivery Fee: PKR ${transformedResponse.orderDetails.deliveryFee}
Total Price: PKR ${transformedResponse.orderDetails.totalPrice}
Payment Method: ${responsePostOrder.paymentMethod}
Payment Status: ${transformedResponse.orderDetails.paymentStatus}
Order Status: ${
    responsePostOrder.orderStatuses.length > 0
      ? responsePostOrder.orderStatuses[
          responsePostOrder.orderStatuses.length - 1
        ].status
      : "Pending"
  }

Shipping Address:
${responsePostOrder.addressId?.firstName || ""} ${
    responsePostOrder.addressId?.lastName || ""
  }
${responsePostOrder.addressId?.streetAddress || ""}
${responsePostOrder.addressId?.city || ""}, Zip Code: ${
    responsePostOrder.addressId?.zipCode || ""
  }
Phone: ${responsePostOrder.addressId?.phone || "N/A"}

Please process the order as soon as possible.

Best regards,  
Your Online Store`;

  const html = `
    <p><strong>Dear Store Owner,</strong></p>
    <p>A new order has been placed. Here are the details:</p>
    <ul>
      <li><strong>Order Number:</strong> ${responsePostOrder.orderNo}</li>
      <li><strong>Order Date:</strong> ${transformedResponse.formattedDate}</li>
      <li><strong>Customer Name:</strong> ${
        responsePostOrder.userId?.username || "N/A"
      }</li>
      <li><strong>Customer Email:</strong> ${
        responsePostOrder.userId?.email || "N/A"
      }</li>
      <li><strong>Customer Phone:</strong> ${
        responsePostOrder.userId?.mobilePhone || "N/A"
      }</li>
    </ul>

    <p><strong>Items Ordered:</strong></p>
    <ul>
      ${responsePostOrder.items
        .map(
          (item, index) =>
            `<li>${index + 1}. <strong>${
              item.productId?.productName || "Unknown Product"
            }</strong> ${
              item.variant ? `(Variant: ${item.variant.variantName})` : ""
            }<br>
            Quantity: ${item.quantity}, Price: PKR ${item.price}, Line Total: PKR ${
              item.lineTotal
            }
            </li>`
        )
        .join("")}
    </ul>

    <p><strong>Order Summary:</strong></p>
    <ul>
      <li><strong>Subtotal:</strong> PKR ${
        transformedResponse.orderDetails.subTotal
      }</li>
      <li><strong>Delivery Fee:</strong> PKR ${
        transformedResponse.orderDetails.deliveryFee
      }</li>
      <li><strong>Total Price:</strong> PKR ${
        transformedResponse.orderDetails.totalPrice
      }</li>
      <li><strong>Payment Method:</strong> ${
        responsePostOrder.paymentMethod
      }</li>
      <li><strong>Payment Status:</strong> ${
        transformedResponse.orderDetails.paymentStatus
        // responsePostOrder.paymentMethod
      }</li>
      <li><strong>Order Status:</strong> ${
        responsePostOrder.orderStatuses.length > 0
          ? responsePostOrder.orderStatuses[
              responsePostOrder.orderStatuses.length - 1
            ].status
          : "Pending"
      }</li>
    </ul>

    <p><strong>Shipping Address:</strong></p>
    <p>
      <strong>${responsePostOrder.addressId?.firstName || ""} ${
    responsePostOrder.addressId?.lastName || ""
  }</strong><br>
      ${responsePostOrder.addressId?.streetAddress || ""}<br>
      ${responsePostOrder.addressId?.city || ""}, Zip Code: ${
    responsePostOrder.addressId?.zipCode || ""
  }<br>
      Phone: ${responsePostOrder.addressId?.phone || "N/A"}
    </p>

    <p>Please process the order as soon as possible.</p>
    <p>Best regards,</p>
    <p>Your Online Store</p>
  `;

  return { subject, text, html };
};

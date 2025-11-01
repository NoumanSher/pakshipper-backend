export const orderConfirmationTemplate = (
  responsePostOrder,
  transformedResponse
) => {
  console.log(transformedResponse);

  const subject = "Order Confirmation - Your Order Has Been Received!";

  const text = `Hello ${transformedResponse.user?.username || "Customer"},
  
Thank you for your order! Here are your order details:

Order Number: ${responsePostOrder.orderNo}
Order Date: ${transformedResponse.formattedDate}

Items Ordered:
${transformedResponse.items
  .map(
    (item, index) =>
      `${index + 1}. ${item.product} ${
        item.variant ? `(Variant: ${item.variant.variantName})` : ""
      }\n   Quantity: ${item.quantity}, Price: PKR ${item.price}, Line Total: PKR ${
        item.lineTotal
      }`
  )
  .join("\n")}

Subtotal: PKR ${transformedResponse.orderDetails.subTotal}
Delivery Fee: PKR ${transformedResponse.orderDetails.deliveryFee}
Total Price: PKR ${transformedResponse.orderDetails.totalPrice}
Payment Method: ${transformedResponse.orderDetails.paymentMethod}
Payment Status: ${transformedResponse.orderDetails.paymentStatus}
Order Status: ${
    responsePostOrder.orderStatuses.length > 0
      ? responsePostOrder.orderStatuses[
          responsePostOrder.orderStatuses.length - 1
        ].status
      : "Pending"
  }

Your order will be delivered to:
${transformedResponse.address.firstName} ${transformedResponse.address.lastName}
${transformedResponse.address.streetAddress}, ${
    transformedResponse.address.city
  }
Zip Code: ${transformedResponse.address.zipCode}
Phone: ${transformedResponse.address.phone}

We appreciate your business!

Best regards,
The ${process.env.COMPANY_NAME} Team`;

  const html = `
    <p>Hello <strong>${
      transformedResponse.user?.username || "Customer"
    }</strong>,</p>
    <p>Thank you for your order! Here are your order details:</p>
    <ul>
      <li><strong>Order Number:</strong> ${responsePostOrder.orderNo}</li>
      <li><strong>Order Date:</strong> ${transformedResponse.formattedDate}</li>
    </ul>
    
    <p><strong>Items Ordered:</strong></p>
    <ul>
      ${transformedResponse.items
        .map(
          (item, index) =>
            `<li>${index + 1}. <strong>${item.product}</strong> ${
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
        transformedResponse.orderDetails.paymentMethod
      }</li>
      <li><strong>Payment Status:</strong> ${
        transformedResponse.orderDetails.paymentStatus
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
      <strong>${transformedResponse.address.firstName} ${
    transformedResponse.address.lastName
  }</strong><br>
      ${transformedResponse.address.streetAddress}, ${
    transformedResponse.address.city
  }<br>
      Zip Code: ${transformedResponse.address.zipCode}<br>
      Phone: ${transformedResponse.address.phone}
    </p>

    <p>We appreciate your business!</p>
    <p>Best regards,</p>
    <p>The <strong>${process.env.COMPANY_NAME}</strong> Team</p>
  `;

  return { subject, text, html };
};

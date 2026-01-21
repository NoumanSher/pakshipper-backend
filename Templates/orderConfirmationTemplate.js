export const orderConfirmationTemplate = (
  responsePostOrder,
  transformedResponse
) => {
  // console.log(transformedResponse);

  const subject = "Order Confirmation - Your Order Has Been Received!";

  const text = `Hello ${transformedResponse.user?.username || "Customer"},

Thank you for your order! Here are your order details:

Order Number: ${responsePostOrder.orderNo}
Order Date: ${transformedResponse.formattedDate}

Items Ordered:
${transformedResponse.items
      .map(
        (item, index) =>
          `${index + 1}. ${item.product} ${item.variant ? `(Variant: ${item.variant.name})` : ""
          }
   Quantity: ${item.quantity}, Price: PKR ${item.price}, Line Total: PKR ${item.lineTotal
          }`
      )
      .join("\n")}

Subtotal: PKR ${transformedResponse.orderDetails.subTotal}
Delivery Fee: PKR ${transformedResponse.orderDetails.deliveryFee}
Total Price: PKR ${transformedResponse.orderDetails.totalPrice}
Payment Method: ${transformedResponse.orderDetails.paymentMethod}
Payment Status: ${transformedResponse.orderDetails.paymentStatus}
Order Status: ${responsePostOrder.orderStatuses.length > 0
      ? responsePostOrder.orderStatuses[
        responsePostOrder.orderStatuses.length - 1
      ].status
      : "Pending"
    }

Track Order: ${process.env.FRONTEND_URL}/profile/order-details?orderId=${responsePostOrder.orderNo}

Your order will be delivered to:
${transformedResponse.address.firstName} ${transformedResponse.address.lastName}
${transformedResponse.address.streetAddress}, ${transformedResponse.address.city}
Zip Code: ${transformedResponse.address.zipCode}
Phone: ${transformedResponse.address.phone}

We appreciate your business!

Best regards,
The ${process.env.COMPANY_NAME} Team`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background-color: #1a1a1a; color: #ffffff; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
        .content { padding: 30px 20px; }
        .greeting { font-size: 18px; margin-bottom: 20px; color: #1a1a1a; }
        .order-info { margin-bottom: 30px; background-color: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; }
        .order-info p { margin: 5px 0; font-size: 14px; color: #555; }
        .order-info strong { color: #333; }
        .table-container { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
        .table-container th { text-align: left; padding: 12px; border-bottom: 2px solid #eee; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        .table-container td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 14px; }
        .product-name { font-weight: 600; color: #333; display: block; }
        .variant-name { font-size: 12px; color: #888; margin-top: 4px; display: block; }
        .totals { width: 100%; border-top: 2px solid #eee; margin-top: 20px; }
        .totals td { padding: 8px 0; font-size: 14px; color: #555; }
        .total-label { text-align: left; }
        .total-value { text-align: right; font-weight: 500; }
        .final-row td { border-top: 1px solid #eee; padding-top: 12px; margin-top: 12px; color: #1a1a1a; font-size: 18px; font-weight: 700; }
        .address-section { background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-top: 30px; }
        .address-section h3 { margin-top: 0; font-size: 16px; margin-bottom: 10px; color: #333; }
        .address-section p { margin: 0; font-size: 14px; line-height: 1.5; color: #555; }
        .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eaeaea; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 50px; background-color: #e3f2fd; color: #1976d2; font-size: 12px; font-weight: 600; }
        .btn-primary { display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; }
        .btn-primary:hover { background-color: #333333; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>Order Confirmed</h1>
        </div>

        <!-- Content -->
        <div class="content">
          <div class="greeting">
            Hello <strong>${transformedResponse.user?.username || "Customer"}</strong>,
          </div>
          <p style="color: #666; line-height: 1.5;">Thank you for your purchase! We've received your order and are getting it ready for shipment.</p>

          <!-- Order Info -->
          <div class="order-info">
            <p><strong>Order Number:</strong> #${responsePostOrder.orderNo}</p>
            <p><strong>Order Date:</strong> ${transformedResponse.formattedDate}</p>
            <p><strong>Status:</strong> <span class="status-badge">${responsePostOrder.orderStatuses.length > 0
      ? responsePostOrder.orderStatuses[
        responsePostOrder.orderStatuses.length - 1
      ].status
      : "Pending"
    }</span></p>
            <p style="margin-top: 15px;">
              <a href="${process.env.FRONTEND_URL}/profile/order-details?orderId=${responsePostOrder.orderNo}" class="btn-primary" target="_blank">Track Your Order</a>
            </p>
          </div>

          <!-- Items Table -->
          <table class="table-container" width="100%" cellpadding="0" cellspacing="0">
            <thead>
              <tr>
                <th width="50%">Item</th>
                <th width="15%" style="text-align: center;">Qty</th>
                <th width="35%" style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${transformedResponse.items
      .map(
        (item) => `
                <tr>
                  <td>
                    <span class="product-name">${item.product}</span>
                    ${item.variant ? `<span class="variant-name">Variant: ${item.variant.name}</span>` : ""}
                  </td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">PKR ${item.lineTotal.toLocaleString()}</td>
                </tr>`
      )
      .join("")}
            </tbody>
          </table>

          <!-- Totals -->
          <table class="totals" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="total-label" width="60%">Subtotal</td>
              <td class="total-value" width="40%">PKR ${transformedResponse.orderDetails.subTotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="total-label">Delivery Fee</td>
              <td class="total-value">PKR ${transformedResponse.orderDetails.deliveryFee.toLocaleString()}</td>
            </tr>
             <tr>
              <td class="total-label">Payment Method</td>
              <td class="total-value" style="text-transform: capitalize;">${transformedResponse.orderDetails.paymentMethod}</td>
            </tr>
             <tr>
              <td class="total-label">Payment Status</td>
              <td class="total-value" style="text-transform: capitalize;">${transformedResponse.orderDetails.paymentStatus}</td>
            </tr>
            <tr class="final-row">
              <td class="total-label">Total</td>
              <td class="total-value">PKR ${transformedResponse.orderDetails.totalPrice.toLocaleString()}</td>
            </tr>
          </table>

          <!-- Shipping Address -->
          <div class="address-section">
            <h3>Shipping Address</h3>
            <p>
              <strong>${transformedResponse.address.firstName} ${transformedResponse.address.lastName}</strong><br>
              ${transformedResponse.address.streetAddress}<br>
              ${transformedResponse.address.city}, ${transformedResponse.address.zipCode}<br>
              ${transformedResponse.address.phone}
            </p>
          </div>

          <p style="margin-top: 30px; color: #666;">We appreciate your business!</p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</p>
          <p>Questions? Contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, text, html };
};

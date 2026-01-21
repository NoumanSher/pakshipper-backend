export const orderStatusUpdateTemplate = (order, newStatus) => {
    const subject = `Order Status Updated - Your Order #${order.orderNo}`;

    const text = `Hello ${order.userId?.username || "Customer"},

Your order #${order.orderNo} status has been updated.

New Status: ${newStatus.status}
${newStatus.statusDesc ? `Description: ${newStatus.statusDesc}` : ""}

Track your order here: ${process.env.FRONTEND_URL}/profile/order-details?orderId=${order.orderNo}

We appreciate your business!

Best regards,
The ${process.env.COMPANY_NAME} Team`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Status Update</title>
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
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 50px; background-color: #e3f2fd; color: #1976d2; font-size: 12px; font-weight: 600; }
        .btn-primary { display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 15px; }
        .btn-primary:hover { background-color: #333333; }
        .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eaeaea; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>Status Updated</h1>
        </div>

        <!-- Content -->
        <div class="content">
          <div class="greeting">
            Hello <strong>${order.userId?.username || "Customer"}</strong>,
          </div>
          <p style="color: #666; line-height: 1.5;">The status of your order <strong>#${order.orderNo}</strong> has been updated.</p>

          <!-- Status Info -->
          <div class="order-info">
            <p><strong>New Status:</strong> <span class="status-badge">${newStatus.status}</span></p>
            ${newStatus.statusDesc ? `<p><strong>Description:</strong> ${newStatus.statusDesc}</p>` : ""}
            <p style="margin-top: 15px;">
              <a href="${process.env.FRONTEND_URL}/profile/order-details?orderId=${order.orderNo}" class="btn-primary" target="_blank">Track Your Order</a>
            </p>
          </div>

          <p style="margin-top: 30px; color: #666;">We appreciate your business!</p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return { subject, text, html };
};

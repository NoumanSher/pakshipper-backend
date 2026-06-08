
import OrderService from "../../services/orderService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional().nullable(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
});

const addressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  streetAddress: z.string().min(1),
  city: z.string().min(1),
  zipCode: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
});

const createOrderSchema = z.object({
  userId: z.string(),
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.string(),
  deliveryFee: z.number().nonnegative(),
  subTotal: z.number().nonnegative(),
  addressId: z.string().optional().nullable(),
  address: addressSchema.optional().nullable(),
  isSaved: z.boolean().optional(),
  discountAmount: z.number().nonnegative().optional(),
});

const updateStatusSchema = z.object({
  orderNo: z.string(),
  status: z.string(),
  statusDesc: z.string().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const markReturnSchema = z.object({
  orderNo: z.string(),
  returnReason: z.string().min(1, "Return reason is required"),
});
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

export const createPostOrder = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const validatedData = createOrderSchema.parse(req.body);
  const transformedResponse = await OrderService.createOrder(req.models, req.tenantConfig, validatedData, io);

  res.status(201).json({
    message: "Order placed successfully!",
    data: transformedResponse,
  });
});
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

export const userAllOrders = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const transformedResponse = await OrderService.getUserOrders(req.models, userId);

  res.status(200).json({
    message: "Order Fetch Successfully!",
    data: transformedResponse,
  });
});
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

export const AllOrders = asyncHandler(async (req, res) => {
  const transformedResponse = await OrderService.getAllOrders(req.models);

  res.status(200).json({
    message: "Order Fetch Successfully!",
    data: transformedResponse,
  });
});

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

export const searchOrderNoOrders = asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const transformedResponse = await OrderService.getOrderByNo(req.models, orderNo);

  res.status(200).json({
    message: "Order Fetch Successfully!",
    data: transformedResponse,
  });
});

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

export const userAddress = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const userAddress = await OrderService.getUserDefaultAddress(req.models, userId);

  res.status(200).json({
    message: "Address fetched successfully!",
    address: userAddress,
  });
});

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

export const orderStatusUpdate = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const { orderNo, status, statusDesc } = updateStatusSchema.parse(req.body);
  const orderStatuses = await OrderService.updateOrderStatus(req.models, req.tenantConfig, orderNo, status, statusDesc, io);

  res.status(200).json({
    message: "Order status updated successfully",
    orderStatuses,
  });
});

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
export const deletePostOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await OrderService.deleteOrder(req.models, id);
  res.status(200).json({ message: "Order deleted successfully" });
});

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
export const bulkDeletePostOrders = asyncHandler(async (req, res) => {
  const { ids } = bulkDeleteSchema.parse(req.body);
  const deletedCount = await OrderService.bulkDeleteOrders(req.models, ids);

  res.status(200).json({
    message: `${deletedCount} orders deleted successfully`,
    deletedCount,
  });
});

/**
 * @function markOrderReturned
 * @description Marks an order as returned/rejected by the customer.
 *              Automatically restores product stock and notifies the customer.
 * @access Admin
 *
 * @param {string} req.body.orderNo    - The unique order number
 * @param {string} req.body.returnReason - Reason for the return (e.g. "Customer Refused")
 *
 * @returns {Object} 200 - Updated orderStatuses array
 * @returns {Object} 400 - Invalid status transition or missing fields
 * @returns {Object} 404 - Order not found
 */
export const markOrderReturned = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const { orderNo, returnReason } = markReturnSchema.parse(req.body);
  const orderStatuses = await OrderService.markAsReturned(req.models, req.tenantConfig, orderNo, returnReason, io);

  res.status(200).json({
    message: "Order marked as returned successfully",
    orderStatuses,
  });
});

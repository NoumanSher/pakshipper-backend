import UserCart from "../../models/UserCart.js";

/**
 * @function updateCartQuantity
 * @description Updates the quantity of a specific item in a user's cart.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Body parameters
 * @param {string} req.body.userId - The ID of the user whose cart is being updated
 * @param {string} req.body.cartItemId - The ID of the cart item to update
 * @param {number} req.body.quantity - The new quantity to set for the cart item
 * 
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - JSON object containing the updated cart item
 * @returns {Object} 400 - Error response if required fields are missing
 * @returns {Object} 404 - Error response if the cart item is not found
 * @returns {Object} 500 - Error response if an internal server error occurs
 * 
 * @example
 * PUT /api/cart/update-quantity
 * Request Body:
 * {
 *   "userId": "user123",
 *   "cartItemId": "cart456",
 *   "quantity": 3
 * }
 * 
 * Response:
 * {
 *   "message": "Cart quantity updated successfully",
 *   "updatedCartItem": {
 *     "_id": "cart456",
 *     "userId": "user123",
 *     "productId": "...",
 *     "variantId": "...",
 *     "quantity": 3
 *   }
 * }
 */
export const updateCartQuantity = async (req, res) => {
    try {
        const { userId, cartItemId, quantity } = req.body;

        if (!userId || !cartItemId || quantity === undefined) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const updatedCartItem = await UserCart.findOneAndUpdate(
            { userId, _id: cartItemId },
            { $set: { quantity } },
            { new: true }
        );

        if (!updatedCartItem) {
            return res.status(404).json({ message: "Cart item not found" });
        }

        res.status(200).json({
            message: "Cart quantity updated successfully",
            updatedCartItem,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error updating cart quantity",
            error: error.message,
        });
    }
};

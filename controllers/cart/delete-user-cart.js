
/**
 * @function deleteCartItem
 * @description Deletes a specific item from a user's cart based on cart item ID and user ID.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.cartItemId - The ID of the cart item to delete.
 * @param {string} req.body.userId - The ID of the user to whom the cart item belongs.
 * 
 * @param {Object} res - Express response object.
 * 
 * @returns {Object} 200 - Success message with the deleted cart item.
 * @returns {Object} 400 - Error response if required fields are missing.
 * @returns {Object} 404 - Error response if the item is not found or does not belong to the user.
 * @returns {Object} 500 - Internal server error response.
 * 
 * @example
 * DELETE /api/cart/delete
 * Request Body:
 * {
 *   "cartItemId": "abc123",
 *   "userId": "user456"
 * }
 * 
 * Response:
 * {
 *   "message": "Cart item deleted successfully",
 *   "deletedCartItem": {
 *     "_id": "abc123",
 *     "userId": "user456",
 *     "productId": "...",
 *     "variantId": "...",
 *     "quantity": 1
 *   }
 * }
 */
export const deleteCartItem = async (req, res) => {
    try {
        const { UserCart } = req.models;
        const { cartItemId, userId } = req.body;

        if (!cartItemId || !userId) {
            return res.status(400).json({ message: "Cart item ID and user ID are required" });
        }

        const deletedCartItem = await UserCart.findOneAndDelete({
            _id: cartItemId,
            userId: userId,
        });

        if (!deletedCartItem) {
            return res.status(404).json({ message: "Cart item not found or does not belong to the user" });
        }

        res.status(200).json({
            message: "Cart item deleted successfully",
            deletedCartItem,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error deleting cart item",
            error: error.message,
        });
    }
};

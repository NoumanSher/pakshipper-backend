import UserCart from "../../models/UserCart.js";

/**
 * @function userCartItems
 * @description Fetches all cart items for a specific user, including populated product and selected variant details.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.userId - The ID of the user whose cart items are being retrieved
 * @param {Object} res - Express response object
 * 
 * @returns {Object} 200 - JSON response with a list of cart items and their variants
 * @returns {Object} 500 - Error response if fetching fails
 * 
 * @example
 * GET /api/cart/:userId
 * 
 * Response:
 * {
 *   message: "Cart Items Fetched Successfully",
 *   cartItems: [
 *     {
 *       _id: "cartItemId",
 *       userId: "userId",
 *       product: "productId",
 *       selectedVariant: { ...variantDetails },
 *       quantity: 2,
 *       ...
 *     }
 *   ]
 * }
 */
export const userCartItems = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all cart items for the user and populate the product details
    const allUserCartItems = await UserCart.find({ userId })
      .populate("productId")
      .lean();

    // Map through the cart items and extract the specific variant
    const cartItemsWithVariants = allUserCartItems.map((item) => {
      const product = item.productId;
      const { productId, ...remainingFields } = item; // Exclude productId
      let variant = null;

      if (item.variantId) {
        variant = product.variants.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
      }

      return {
        ...remainingFields,
        product: productId,
        selectedVariant: variant,
      };
    });

    res.status(200).json({
      message: "Cart Items Fetched Successfully",
      cartItems: cartItemsWithVariants,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error Fetching Cart Items",
      error: error.message,
    });
  }
};

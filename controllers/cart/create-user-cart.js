export const createUserCart = async (req, res) => {
  try {
    const { UserCart } = req.models;
    const { userId, productId, variantId, quantity } = req.body;

    // Ensure quantity is a valid number
    const parsedQuantity = Number(quantity);
    if (!parsedQuantity || parsedQuantity < 1) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    // Check if the item already exists in the cart
    const existingCartItem = await UserCart.findOne({ userId, productId, variantId });

    let savedCartItem;

    if (existingCartItem) {
      // Increment quantity if item already exists
      existingCartItem.quantity += parsedQuantity;
      savedCartItem = await existingCartItem.save();
    } else {
      // Otherwise, create a new cart entry
      const newUserCart = new UserCart({ userId, productId, variantId, quantity: parsedQuantity });
      savedCartItem = await newUserCart.save();
    }

    res.status(201).json({
      message: "Item added to cart successfully!",
      cartItem: savedCartItem,
    });
  } catch (error) {
    console.error("Error creating user cart:", error);
    res.status(500).json({ message: "Error creating user cart", error: error.message });
  }
};

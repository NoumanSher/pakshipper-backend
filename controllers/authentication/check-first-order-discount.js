import asyncHandler from "../../middlewares/asyncHandler.js";

import AppError from "../../utils/AppError.js";

/**
 * @route   GET /api/auth/first-order-discount/:userId
 * @desc    Check if a user is eligible for the first-order 5% discount
 * @access  Private
 * @returns { eligible: boolean, discountPercent: number }
 */
export const checkFirstOrderDiscount = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const { User, PostOrder } = req.models;
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);

  // Not eligible if flag already used
  if (user.firstOrderDiscountUsed) {
    return res.status(200).json({ eligible: false, discountPercent: 0 });
  }

  // Also verify they have zero completed orders
  const orderCount = await PostOrder.countDocuments({ userId });
  const eligible = orderCount === 0;

  return res.status(200).json({ eligible, discountPercent: eligible ? 5 : 0 });
});

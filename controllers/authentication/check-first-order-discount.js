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

  const { User, PostOrder, Settings } = req.models;
  
  // Fetch merchant store settings
  const settings = await Settings.findOne();
  const promoConfig = settings?.firstOrderDiscount || {
    enabled: true,
    discountType: "percentage",
    discountValue: 5,
    startDate: null,
    endDate: null,
    title: "Get 5% OFF On Your First Order",
    subtitle: "Sign up and unlock your instant discount.",
  };

  // If promotion is disabled by merchant
  if (!promoConfig.enabled) {
    return res.status(200).json({ eligible: false, discountPercent: 0, discountType: promoConfig.discountType, discountValue: 0, config: promoConfig });
  }

  // Check date range if configured
  const now = new Date();
  if (promoConfig.startDate && new Date(promoConfig.startDate) > now) {
    return res.status(200).json({ eligible: false, discountPercent: 0, discountType: promoConfig.discountType, discountValue: 0, config: promoConfig });
  }
  if (promoConfig.endDate && new Date(promoConfig.endDate) < now) {
    return res.status(200).json({ eligible: false, discountPercent: 0, discountType: promoConfig.discountType, discountValue: 0, config: promoConfig });
  }

  // Calculate formatted time remaining if endDate is set
  let timeRemainingText = "";
  if (promoConfig.endDate) {
    const diffMs = new Date(promoConfig.endDate).getTime() - now.getTime();
    if (diffMs > 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays >= 1) {
        timeRemainingText = `Ends in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
      } else if (diffHours >= 1) {
        timeRemainingText = `Ends in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        timeRemainingText = `Ends in ${diffMins} min${diffMins > 1 ? "s" : ""}`;
      }
    }
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);

  // Not eligible if flag already used
  if (user.firstOrderDiscountUsed) {
    return res.status(200).json({ eligible: false, discountPercent: 0, discountType: promoConfig.discountType, discountValue: 0, config: promoConfig });
  }

  // Also verify they have zero completed orders
  const orderCount = await PostOrder.countDocuments({ userId });
  const eligible = orderCount === 0;

  const discountValue = eligible ? (promoConfig.discountValue ?? 5) : 0;
  const discountPercent = promoConfig.discountType === "percentage" ? discountValue : 0;

  return res.status(200).json({
    eligible,
    discountType: promoConfig.discountType || "percentage",
    discountValue,
    discountPercent,
    timeRemainingText,
    config: {
      enabled: promoConfig.enabled,
      discountType: promoConfig.discountType,
      discountValue: promoConfig.discountValue,
      title: promoConfig.title,
      subtitle: promoConfig.subtitle,
      startDate: promoConfig.startDate,
      endDate: promoConfig.endDate,
    },
  });
});

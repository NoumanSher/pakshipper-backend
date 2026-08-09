import FaqService from "../../services/faqService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

/**
 * @route   DELETE /api/faqs/:id
 * @desc    Delete a FAQ by ID
 * @access  Admin/Merchant
 */
export const deleteFaq = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await FaqService.deleteFaq(req.models, id);

  res.status(200).json({
    message: "FAQ deleted successfully",
  });
});

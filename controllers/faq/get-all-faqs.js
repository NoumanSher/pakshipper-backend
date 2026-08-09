import FaqService from "../../services/faqService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

/**
 * @route   GET /api/faqs
 * @desc    Get all FAQs (public gets active only, admin/merchant gets all if query includes admin mode or if checked)
 * @access  Public / Merchant
 */
export const getAllFaqs = asyncHandler(async (req, res) => {
  // If the request includes user auth and is a request from admin/merchant panel, return all FAQs
  const isAdminRequest = req.query.admin === "true";
  let faqs;
  if (isAdminRequest) {
    faqs = await FaqService.getAllFaqsAdmin(req.models);
  } else {
    faqs = await FaqService.getAllFaqs(req.models);
  }

  res.status(200).json(faqs);
});

import FaqService from "../../services/faqService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import jwt from "jsonwebtoken";

/**
 * @route   GET /api/faqs
 * @desc    Get all FAQs (public gets active only, authenticated merchant with ?admin=true gets all)
 * @access  Public / Merchant
 */
export const getAllFaqs = asyncHandler(async (req, res) => {
  const wantsAdmin = req.query.admin === "true";
  let isAuthorized = false;

  if (wantsAdmin) {
    const authHeader = req.header("Authorization") || req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded && (decoded.roleLevel >= 10 || decoded.role === 'owner' || decoded.role === 'store_admin')) {
          isAuthorized = true;
        }
      } catch (err) {
        // Token invalid/expired -> treat as unauthenticated
      }
    }
  }

  const faqs = wantsAdmin && isAuthorized
    ? await FaqService.getAllFaqsAdmin(req.models)
    : await FaqService.getAllFaqs(req.models);

  res.status(200).json(faqs);
});

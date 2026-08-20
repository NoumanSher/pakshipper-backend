import FaqService from "../../services/faqService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  category: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @route   POST /api/faqs
 * @desc    Create a new FAQ
 * @access  Admin/Merchant
 */
export const createFaq = asyncHandler(async (req, res) => {
  const validatedData = faqSchema.parse(req.body);
  const newFaq = await FaqService.createFaq(req.models, validatedData);

  res.status(201).json({
    message: "FAQ created successfully",
    faq: newFaq,
  });
});

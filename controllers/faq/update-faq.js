import FaqService from "../../services/faqService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import { z } from "zod";

const faqSchema = z.object({
  question: z.string().min(1, "Question is required").optional(),
  answer: z.string().min(1, "Answer is required").optional(),
  category: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

/**
 * @route   PUT /api/faqs/:id
 * @desc    Update a FAQ by ID
 * @access  Admin/Merchant
 */
export const updateFaq = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const validatedData = faqSchema.parse(req.body);
  const updatedFaq = await FaqService.updateFaq(req.models, id, validatedData);

  res.status(200).json({
    message: "FAQ updated successfully",
    faq: updatedFaq,
  });
});

import AppError from "../utils/AppError.js";

class FaqService {
  /**
   * Get all active FAQs sorted by order ascending.
   */
  static async getAllFaqs(models) {
    const { Faq } = models;
    return await Faq.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
  }

  /**
   * Get ALL FAQs (including inactive) for admin panel.
   */
  static async getAllFaqsAdmin(models) {
    const { Faq } = models;
    return await Faq.find().sort({ order: 1, createdAt: 1 }).lean();
  }

  /**
   * Create a new FAQ.
   */
  static async createFaq(models, data) {
    const { Faq } = models;
    const faq = new Faq(data);
    await faq.save();
    return faq;
  }

  /**
   * Update a FAQ by ID.
   */
  static async updateFaq(models, id, data) {
    const { Faq } = models;
    const updated = await Faq.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw new AppError("FAQ not found", 404);
    return updated;
  }

  /**
   * Delete a FAQ by ID.
   */
  static async deleteFaq(models, id) {
    const { Faq } = models;
    const deleted = await Faq.findByIdAndDelete(id);
    if (!deleted) throw new AppError("FAQ not found", 404);
    return deleted;
  }
}

export default FaqService;

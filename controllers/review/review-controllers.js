import mongoose from "mongoose";
import { getTenantRedisKey } from "../../config/redis/redisHelpers.js";
import client from "../../config/redis/redisClient.js";
import { deleteMultipleFromCloudinary } from "../../utils/cloudinaryHelper.js";

/**
 * Create a new review for a product.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Expected request body:
 * {
 *   userId: String,
 *   productId: String,
 *   rating: Number,
 *   description: String
 * }
 *
 * Flow:
 * 1. Validates required fields.
 * 2. Checks if the user and product exist.
 * 3. Prevents duplicate reviews from the same user on the same product.
 * 4. Saves and returns the review (pending approval).
 */
export const createReview = async (req, res) => {
  try {
    const { Product: products, User: userSchema, Review } = req.models;
    const { userId, productId, rating, description, images, createdAt } = req.body;

    // Validate required fields
    if (!userId || !productId || !rating || !description) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    // Check if user exists
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if product exists
    const product = await products.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      return res.status(400).json({
        message: "You have already reviewed this product",
      });
    }

    // Create and save new review
    const newReview = new Review({
      userId,
      productId,
      rating,
      description,
      images,
      ...(createdAt && { createdAt }),
    });

    const savedReview = await newReview.save();

    // Populate user and product info for response
    await savedReview.populate("userId", "username email");
    await savedReview.populate("productId", "productName");

    res.status(201).json({
      message: "Review submitted successfully and is pending approval",
      review: savedReview,
    });
  } catch (error) {
    // Handle duplicate key error (optional fallback)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "You have already reviewed this product",
      });
    }

    res.status(500).json({
      message: "Error creating review",
      error: error.message,
    });
  }
};

/**
 * Get reviews for a specific product.
 *
 * Supports pagination, sorting, and rating statistics. If `userId` is provided,
 * the response includes both approved reviews and the requesting user's pending review(s).
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Request Params:
 *  - productId (string): ID of the product (required)
 *
 * Query Params:
 *  - userId (string): Optional - include user's own pending review
 *  - status (string): Default is "approved"
 *  - page (number): Pagination page number (default: 1)
 *  - limit (number): Items per page (default: 10)
 *  - sortBy (string): Field to sort by (default: "createdAt")
 *  - sortOrder (string): "asc" or "desc" (default: "desc")
 */
export const productReview = async (req, res) => {
  try {
    const { Review, PostOrder: postOrder } = req.models;
    const { productId } = req.params;
    const { userId } = req.query;

    const {
      status = "approved",
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const skip = (page - 1) * limit;
    const allowedSortFields = ["createdAt", "rating", "helpfulCount"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    const reviewQuery = userId
      ? {
        productId,
        $or: [{ status: "approved" }, { status: "pending", userId }],
      }
      : { productId, status: "approved" };

    const reviews = await Review.find(reviewQuery)
      .populate("userId", "username")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const totalReviews = await Review.countDocuments(reviewQuery);

    const ratingStats = await Review.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingDistribution: { $push: "$rating" },
        },
      },
    ]);

    const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0 };

    // ✅ Determine if user has already reviewed or can review
    let canReview = false;
    let isReviewed = false;

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      // Check if user already reviewed
      const hasReviewed = await Review.exists({ userId, productId });

      if (hasReviewed) {
        isReviewed = true;
      } else {
        // ✅ Check if user purchased AND order is Delivered
        const hasOrderedDelivered = await postOrder.exists({
          userId,
          items: {
            $elemMatch: { productId: new mongoose.Types.ObjectId(productId) },
          },
          orderStatuses: {
            $elemMatch: { status: "Delivered" },
          },
        });

        if (hasOrderedDelivered) {
          canReview = true;
        }
      }
    }

    // ✅ Final response
    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNext: page * limit < totalReviews,
        hasPrev: page > 1,
      },
      stats: {
        averageRating: Math.round(stats.averageRating * 10) / 10,
        totalReviews: stats.totalReviews,
      },
      ...(userId && { canReview, isReviewed }), // include only if userId provided
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching reviews",
      error: error.message,
    });
  }
};

/**
 * Edit a user’s own review.
 *
 * Validates ownership before allowing update. Resets the review status to "pending"
 * if it was previously approved.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Request Params:
 *  - reviewId (string): ID of the review to be edited (required)
 *
 * Request Body:
 *  - userId (string): ID of the user attempting to edit (required)
 *  - rating (number): Optional - new rating value
 *  - description (string): Optional - new review text
 */
export const userReviewEdit = async (req, res) => {
  try {
    const { Review } = req.models;
    const { reviewId } = req.params;
    const { rating, description, userId } = req.body;

    // Validate review ID format
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    // Find the review by ID
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if the review belongs to the user
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can only edit your own reviews",
      });
    }

    // Apply changes if provided
    if (rating !== undefined) review.rating = rating;
    if (description !== undefined) review.description = description;

    // Reset status to pending for re-approval
    if (review.status === "approved") {
      review.status = "pending";
    }

    // Save and populate related info
    const updatedReview = await review.save();
    await updatedReview.populate("userId", "username email");
    await updatedReview.populate("productId", "productName");

    res.status(200).json({
      message: "Review updated successfully and is pending approval",
      review: updatedReview,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating review",
      error: error.message,
    });
  }
};

/**
 * Get all reviews for admin panel.
 *
 * Supports filtering by review status, sorting, and pagination.
 * Only accessible by admin users.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Query Params:
 *  - status (string): Optional - filter reviews by status (e.g., "pending", "approved", "rejected")
 *  - page (number): Pagination page number (default: 1)
 *  - limit (number): Items per page (default: 20)
 *  - sortBy (string): Field to sort by (default: "createdAt")
 *  - sortOrder (string): "asc" or "desc" (default: "desc")
 */
export const adminAllReview = async (req, res) => {
  try {
    const { Review } = req.models;
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build MongoDB filter for status if provided
    const filter = status ? { status } : {};

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Fetch reviews with user and product populated
    const reviews = await Review.find(filter)
      .populate("userId", "username email")
      .populate("productId", "productName")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const totalReviews = await Review.countDocuments(filter);

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNext: page * limit < totalReviews,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching reviews",
      error: error.message,
    });
  }
};

/**
 * Update the status of a review (admin only).
 *
 * Admin can approve, reject, or mark a review as pending. Optionally includes a message.
 * Automatically recalculates the product's average rating upon approval.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Request Params:
 *  - reviewId (string): ID of the review to update
 *
 * Request Body:
 *  - status (string): New status ("approved", "rejected", or "pending")
 *  - adminMessage (string): Optional - admin message/reason
 */
export const statusApprove = async (req, res) => {
  try {
    const { Product: products, Review } = req.models;
    const { reviewId } = req.params;
    const { status, adminMessage } = req.body;

    // Validate review ID
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    // Validate status value
    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be 'approved', 'rejected', or 'pending'",
      });
    }

    // Find review by ID
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Update review status
    review.status = status;

    // If admin left a message, store it
    if (adminMessage) {
      review.adminResponse = {
        message: adminMessage,
        respondedBy: req.user._id, // Assuming req.user is set by auth middleware
        respondedAt: new Date(),
      };
    }

    const updatedReview = await review.save();
    await updatedReview.populate("userId", "username email");
    await updatedReview.populate("productId", "productName");

    // If approved, update product's average rating and total review count
    if (status === "approved") {
      const approvedReviews = await Review.find({
        productId: review.productId,
        status: "approved",
      });

      const totalReviews = approvedReviews.length;
      const averageRating =
        totalReviews > 0
          ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          : 0;

      await products.findByIdAndUpdate(review.productId, {
        rating: averageRating.toFixed(1),
        reveiws: totalReviews,
      });
    }

    // Clear Redis cache for the specific product
    await client.del(getTenantRedisKey(req.tenantConfig.tenantId, `product::${review.productId}`));

    res.status(200).json({
      message: `Review ${status} successfully`,
      review: updatedReview,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating review status",
      error: error.message,
    });
  }
};

/**
 * Delete a review by ID.
 *
 * Users can delete their own reviews. Admins can delete any review.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Request Params:
 *  - reviewId (string): ID of the review to delete
 *
 * Request Body:
 *  - userId (string): ID of the user requesting deletion
 *  - isAdmin (boolean): Whether the requester is an admin
 */
export const deleteReveiw = async (req, res) => {
  try {
    const { Review } = req.models;
    const { reviewId } = req.params;
    const { userId, isAdmin } = req.body;

    // Validate reviewId
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Permission check: user must own the review, unless admin
    if (!isAdmin && review.userId.toString() !== userId) {
      return res.status(403).json({
        message: "You can only delete your own reviews",
      });
    }

    // Delete associated images from Cloudinary
    if (review.images && review.images.length > 0) {
      // Review images are uploaded using standard config, so useAdminConfig = false
      await deleteMultipleFromCloudinary(review.images, false).catch(err => 
        console.error("Cloudinary image deletion failed for review:", err)
      );
    }

    await Review.findByIdAndDelete(reviewId);

    // Optional: Clear product cache or update product's review count if needed

    res.status(200).json({
      message: "Review and associated images deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting review",
      error: error.message,
    });
  }
};

/**
 * Get all reviews made by a specific user.
 *
 * Supports pagination and sorting.
 *
 * @param {Express.Request} req - HTTP request object.
 * @param {Express.Response} res - HTTP response object.
 * @returns {Promise<void>}
 *
 * Request Params:
 *  - userId (string): ID of the user
 *
 * Query Params:
 *  - page (number): Page number for pagination (default: 1)
 *  - limit (number): Number of reviews per page (default: 10)
 *  - sortBy (string): Field to sort by (default: "createdAt")
 *  - sortOrder (string): Sort order, either "asc" or "desc" (default: "desc")
 */
export const userAllReveiw = async (req, res) => {
  try {
    const { Review } = req.models;
    const { userId } = req.params;
    const {
      status = "approved",
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Fetch paginated user reviews
    const reviews = await Review.find({ userId })
      .populate("productId", "productName images")
      .sort(sort)
      .skip(skip)
      .limit(Number.parseInt(limit));

    const totalReviews = await Review.countDocuments({ userId });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: Number.parseInt(page),
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        hasNext: page * limit < totalReviews,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user reviews",
      error: error.message,
    });
  }
};

export const toggleHelpfulReview = async (req, res) => {
  try {
    const { Review } = req.models;
    const { userId, reviewId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(reviewId)
    ) {
      return res.status(400).json({ message: "Invalid userId or reviewId" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const hasMarkedHelpful = review.helpfulBy.includes(userId);

    if (hasMarkedHelpful) {
      // Remove user from helpfulBy and decrease count
      review.helpfulBy.pull(userId);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add user to helpfulBy and increase count
      review.helpfulBy.push(userId);
      review.helpfulCount += 1;
    }

    await review.save();

    return res.status(200).json({
      message: hasMarkedHelpful ? "Marked as not helpful" : "Marked as helpful",
      helpfulCount: review.helpfulCount,
      helpfulBy: review.helpfulBy,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating helpful count",
      error: error.message,
    });
  }
};

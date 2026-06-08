import mongoose from "mongoose";
import { getTenantRedisKey, flushTenantCache } from "../../config/redis/redisHelpers.js";
import client from "../../config/redis/redisClient.js";

/**
 * Approve a product
 * @route PATCH /api/products/:id/approve
 * @access Admin or users with product_approval permission
 */
export const approveProduct = async (req, res) => {
    try {
        const { Product } = req.models;
        const { id } = req.params;
        const { comments } = req.body;
        const approverId = req.user._id || req.user.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.approvalStatus === 'approved') {
            return res.status(400).json({ success: false, message: "Product is already approved" });
        }

        // Update approval status
        product.approvalStatus = 'approved';
        product.approvalInfo = {
            approvedBy: approverId,
            approvedAt: new Date(),
            rejectionReason: null,
            comments: comments || null
        };

        // Add to history
        product.approvalHistory.push({
            action: 'approved',
            performedBy: approverId,
            performedAt: new Date(),
            comments: comments || null
        });

        await product.save();
        await flushTenantCache(req.tenantConfig.tenantId); // Clear cache

        // TODO: Emit socket notification to product creator
        // io.to(product.createdBy.toString()).emit('product:approved', {...});

        res.status(200).json({
            success: true,
            message: "Product approved successfully",
            product: {
                id: product._id,
                name: product.productName,
                approvalStatus: product.approvalStatus,
                approvalInfo: product.approvalInfo
            }
        });
    } catch (error) {
        console.error("Error approving product:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Reject a product
 * @route PATCH /api/products/:id/reject
 * @access Admin or users with product_approval permission
 */
export const rejectProduct = async (req, res) => {
    try {
        const { Product } = req.models;
        const { id } = req.params;
        const { reason, comments } = req.body;
        const rejecterId = req.user._id || req.user.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required"
            });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.approvalStatus === 'rejected') {
            return res.status(400).json({ success: false, message: "Product is already rejected" });
        }

        // Update approval status
        product.approvalStatus = 'rejected';
        product.approvalInfo = {
            approvedBy: rejecterId,
            approvedAt: new Date(),
            rejectionReason: reason,
            comments: comments || null
        };

        // Add to history
        product.approvalHistory.push({
            action: 'rejected',
            performedBy: rejecterId,
            performedAt: new Date(),
            reason: reason,
            comments: comments || null
        });

        await product.save();
        await flushTenantCache(req.tenantConfig.tenantId); // Clear cache

        // TODO: Emit socket notification to product creator
        // io.to(product.createdBy.toString()).emit('product:rejected', {...});

        res.status(200).json({
            success: true,
            message: "Product rejected",
            product: {
                id: product._id,
                name: product.productName,
                approvalStatus: product.approvalStatus,
                approvalInfo: product.approvalInfo
            }
        });
    } catch (error) {
        console.error("Error rejecting product:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Resubmit a rejected product for approval
 * @route PATCH /api/products/:id/resubmit
 * @access Product owner or admin
 */
export const resubmitProduct = async (req, res) => {
    try {
        const { Product } = req.models;
        const { id } = req.params;
        const userId = req.user._id || req.user.id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.approvalStatus !== 'rejected') {
            return res.status(400).json({
                success: false,
                message: "Only rejected products can be resubmitted"
            });
        }

        // Reset to pending
        product.approvalStatus = 'pending';

        // Add to history
        product.approvalHistory.push({
            action: 'resubmitted',
            performedBy: userId,
            performedAt: new Date(),
            comments: 'Product edited and resubmitted for approval'
        });

        await product.save();
        await flushTenantCache(req.tenantConfig.tenantId); // Clear cache

        // TODO: Emit socket notification to approvers
        // io.to('approvers').emit('product:pending-approval', {...});

        res.status(200).json({
            success: true,
            message: "Product resubmitted for approval",
            product: {
                id: product._id,
                name: product.productName,
                approvalStatus: product.approvalStatus
            }
        });
    } catch (error) {
        console.error("Error resubmitting product:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Get all pending products
 * @route GET /api/products/pending
 * @access Admin or users with product_approval permission
 */
export const getPendingProducts = async (req, res) => {
    try {
        const { Product } = req.models;
        const { page = 1, limit = 20, sort = 'createdAt' } = req.query;

        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 20;
        const skip = (pageNumber - 1) * limitNumber;

        const rawKey = `products::pending::${pageNumber}::${limitNumber}`;
        const cacheKey = getTenantRedisKey(req.tenantConfig.tenantId, rawKey);

        // Check cache
        const cached = await client.get(cacheKey);
        if (cached) {
            console.log("✅ Cache hit (pending products)");
            return res.status(200).json(JSON.parse(cached));
        }

        const [products, totalProducts] = await Promise.all([
            Product.find({ approvalStatus: 'pending' })
                .select('productName salePrice stock images seo createdBy createdAt approvalStatus')
                .populate('createdBy', 'name email')
                .populate('parentCategoryID', 'name')
                .populate('childCategoryID', 'name')
                .sort({ [sort]: -1 })
                .skip(skip)
                .limit(limitNumber)
                .lean(),
            Product.countDocuments({ approvalStatus: 'pending' })
        ]);

        const totalPages = Math.ceil(totalProducts / limitNumber);

        const response = {
            success: true,
            products,
            pagination: {
                total: totalProducts,
                pages: totalPages,
                page: pageNumber,
                limit: limitNumber
            }
        };

        await client.setEx(cacheKey, 60, JSON.stringify(response)); // Cache for 1 minute
        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching pending products:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Get approval history for a product
 * @route GET /api/products/:id/approval-history
 * @access Admin or product owner
 */
export const getApprovalHistory = async (req, res) => {
    try {
        const { Product } = req.models;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }

        const product = await Product.findById(id)
            .select('productName approvalStatus approvalInfo approvalHistory')
            .populate('approvalInfo.approvedBy', 'name email')
            .populate('approvalHistory.performedBy', 'name email')
            .lean();

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({
            success: true,
            productName: product.productName,
            currentStatus: product.approvalStatus,
            approvalInfo: product.approvalInfo,
            history: product.approvalHistory
        });
    } catch (error) {
        console.error("Error fetching approval history:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Auto-approve all existing products (Migration endpoint)
 * @route POST /api/products/migrate/approve-existing
 * @access Admin only (run once)
 */
export const autoApproveExistingProducts = async (req, res) => {
    try {
        const { Product } = req.models;
        const adminUserId = req.user._id || req.user.id;

        const result = await Product.updateMany(
            {
                $or: [
                    { approvalStatus: { $exists: false } },
                    { approvalStatus: null }
                ]
            },
            {
                $set: {
                    approvalStatus: 'approved',
                    'approvalInfo.approvedBy': adminUserId,
                    'approvalInfo.approvedAt': new Date(),
                    'approvalInfo.comments': 'Auto-approved during system migration'
                },
                $push: {
                    approvalHistory: {
                        action: 'approved',
                        performedBy: adminUserId,
                        performedAt: new Date(),
                        comments: 'Auto-approved during system migration'
                    }
                }
            }
        );

        await flushTenantCache(req.tenantConfig.tenantId); // Clear all cache

        res.status(200).json({
            success: true,
            message: "Existing products auto-approved successfully",
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error("Error auto-approving products:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

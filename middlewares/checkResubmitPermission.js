/**
 * Middleware to check if user can resubmit a product.
 * Uses req.models (from tenantResolver) instead of mongoose.model() for multi-tenancy.
 * Uses structured RBAC with level-based hierarchy.
 * 
 * Allows: Product owner, users with products:approve permission, or level >= 90 (admin/owner)
 */
const checkResubmitPermission = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const productId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!productId) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // Get user with role and permissions
        const { User, Product } = req.models;
        const user = await User.findById(userId).populate('role').lean();

        if (!user || !user.role) {
            return res.status(403).json({ error: 'No role assigned to user' });
        }

        // Check 1: Name-based bypass (owner/store_admin always pass)
        const roleName = (user.role.name || '').toLowerCase();
        if (roleName === 'owner' || roleName === 'store_admin') {
            return next();
        }

        // Check 2: Level-based bypass (level >= 90)
        if (user.role.level && user.role.level >= 90) {
            return next();
        }

        const permissions = user.role.permissions || [];

        // Check 2: Does user have products:approve permission?
        const hasApprovePermission = permissions.some(
            (p) => p.resource === 'products' && p.actions && p.actions.includes('approve')
        );

        if (hasApprovePermission) {
            return next();
        }

        // Check 3: Is user the owner of the product?
        const product = await Product.findById(productId).lean();

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const isOwner = product.createdBy && product.createdBy.toString() === userId.toString();

        if (isOwner) {
            return next();
        }

        // User is neither admin, approver, nor owner
        return res.status(403).json({
            error: 'You do not have permission to resubmit this product. Only the product owner, approvers, or admins can resubmit.'
        });

    } catch (error) {
        console.error('Error in checkResubmitPermission middleware:', error);
        return res.status(500).json({
            error: 'Internal server error during permission check'
        });
    }
};

export default checkResubmitPermission;

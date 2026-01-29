import mongoose from 'mongoose';

/**
 * Middleware to check if user can resubmit a product
 * Allows: Product owner, users with product_approval permission, or admins
 */
const checkResubmitPermission = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const productId = req.params.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // Get user with role and permissions
        const User = mongoose.model('User');
        const user = await User.findById(userId).populate('role').lean();

        if (!user || !user.role) {
            return res.status(403).json({ error: 'No role assigned to user' });
        }

        const permissions = user.role.permissions || [];
        const roleName = user.role.name;

        // Check 1: Is user an Admin?
        if (roleName === 'Admin' || roleName === 'Super Admin') {
            console.log(`✅ User is ${roleName} - allowing resubmit`);
            return next();
        }

        // Check 2: Does user have product_approval permission?
        if (permissions.includes('product_approval')) {
            console.log('✅ User has product_approval permission - allowing resubmit');
            return next();
        }

        // Check 3: Is user the owner of the product?
        const Product = mongoose.model('Product');
        const product = await Product.findById(productId).lean();

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const isOwner = product.createdBy && product.createdBy.toString() === userId.toString();

        if (isOwner) {
            console.log('✅ User owns the product - allowing resubmit');
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

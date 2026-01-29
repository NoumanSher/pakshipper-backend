import mongoose from 'mongoose';

/**
 * Middleware factory that checks if user has permission OR owns the resource
 * 
 * @param {string} resource - Resource type (e.g., 'products', 'orders')
 * @param {string} action - Action type ('update' or 'delete')
 * @param {string} idParam - Route parameter name for resource ID (default: 'id')
 * @returns {Function} Express middleware function
 */
const checkOwnershipOrPermission = (resource, action, idParam = 'id') => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id || req.user?._id;

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Get user's permissions from their role
            const User = mongoose.model('User');
            const user = await User.findById(userId).populate('role').lean();

            if (!user || !user.role) {
                return res.status(403).json({ error: 'No role assigned to user' });
            }

            const permissions = user.role.permissions || [];
            const requiredPermission = `${action}:${resource}`;
            const writePermission = `write:${resource}`;

            // DEBUG: Log user role and permissions
            console.log('🔍 DEBUG - User Role Name:', user.role.name);
            console.log('🔍 DEBUG - User Permissions:', permissions);
            console.log('🔍 DEBUG - Required Permission:', requiredPermission);

            // Check 1: Does user have 'all' permission? (Super admin with all permissions)
            if (permissions.includes('all')) {
                console.log(`✅ User has 'all' permission - allowing ${action}`);
                return next();
            }

            // Check 2: Is user an Admin? (Case-insensitive check)
            const roleName = user.role.name?.toLowerCase();
            if (roleName === 'admin' || roleName === 'super admin') {
                console.log(`✅ User is ${user.role.name} - allowing ${action}`);
                return next();
            }

            // Check 3: Does user have the full permission? (e.g., "update:products")
            if (permissions.includes(requiredPermission)) {
                console.log(`✅ User has ${requiredPermission} permission - bypassing ownership check`);
                return next();
            }

            // Check 3: Does user have write permission? If so, check ownership
            if (permissions.includes(writePermission)) {
                const resourceId = req.params[idParam];

                if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
                    return res.status(400).json({ error: 'Invalid resource ID' });
                }

                // Load the resource to check ownership
                const Model = mongoose.model(getModelName(resource));
                const doc = await Model.findById(resourceId).lean();

                if (!doc) {
                    return res.status(404).json({ error: `${resource} not found` });
                }

                // Check if user owns this resource
                const isOwner = doc.createdBy && doc.createdBy.toString() === userId.toString();

                if (isOwner) {
                    console.log(`✅ User owns the ${resource} - allowing ${action}`);
                    return next();
                }

                // Has write permission but doesn't own the resource
                return res.status(403).json({
                    error: `Access denied. You can only ${action} your own ${resource}.`
                });
            }

            // User has neither the permission nor ownership nor admin role
            return res.status(403).json({
                error: `Missing permission: ${requiredPermission}`
            });

        } catch (error) {
            console.error('Error in checkOwnershipOrPermission middleware:', error);
            return res.status(500).json({
                error: 'Internal server error during permission check'
            });
        }
    };
};

/**
 * Helper function to get the Mongoose model name from resource string
 * @param {string} resource - Resource name (lowercase plural)
 * @returns {string} Model name
 */
function getModelName(resource) {
    const modelMap = {
        'products': 'Product',
        'orders': 'Order',
        'categories': 'Category',
        // Add more mappings as needed
    };

    return modelMap[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
}

export default checkOwnershipOrPermission;

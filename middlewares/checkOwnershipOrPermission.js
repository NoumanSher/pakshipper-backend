/**
 * Middleware factory that checks if user has permission OR owns the resource.
 * Uses req.models (from tenantResolver) instead of mongoose.model() for multi-tenancy.
 * Uses structured RBAC permissions with level-based hierarchy.
 *
 * @param {string} resource - Resource type (e.g., 'products', 'orders')
 * @param {string} action - Action type ('read', 'write', 'delete', 'approve')
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
            const { User } = req.models;
            const user = await User.findById(userId).populate('role').lean();

            if (!user || !user.role) {
                return res.status(403).json({ error: 'No role assigned to user' });
            }

            // Name-based bypass: owner and store_admin always have full access
            const roleName = (user.role.name || '').toLowerCase();
            if (roleName === 'owner' || roleName === 'store_admin') {
                return next();
            }

            // Level-based bypass: level >= 90 bypasses all checks
            if (user.role.level && user.role.level >= 90) {
                return next();
            }

            const permissions = user.role.permissions || [];

            // Check 1: Does user have the full structured permission for this resource + action?
            const hasFullPermission = permissions.some(
                (p) => p.resource === resource && p.actions && p.actions.includes(action)
            );

            if (hasFullPermission) {
                return next();
            }

            // Check 2: Does user have write permission? If so, check ownership
            const hasWritePermission = permissions.some(
                (p) => p.resource === resource && p.actions && p.actions.includes('write')
            );

            if (hasWritePermission) {
                const resourceId = req.params[idParam];

                if (!resourceId) {
                    return res.status(400).json({ error: 'Invalid resource ID' });
                }

                // Load the resource to check ownership
                const Model = req.models[getModelName(resource)];
                if (!Model) {
                    return res.status(500).json({ error: `Model not found for resource: ${resource}` });
                }

                const doc = await Model.findById(resourceId).lean();

                if (!doc) {
                    return res.status(404).json({ error: `${resource} not found` });
                }

                // Check if user owns this resource
                const isOwner = doc.createdBy && doc.createdBy.toString() === userId.toString();

                if (isOwner) {
                    return next();
                }

                // Has write permission but doesn't own the resource
                return res.status(403).json({
                    error: `Access denied. You can only ${action} your own ${resource}.`
                });
            }

            // User has neither the permission nor ownership
            return res.status(403).json({
                error: `Missing permission: ${action}:${resource}`
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
        'orders': 'PostOrder',
        'categories': 'ParentCategories',
        'reviews': 'Review',
        'customers': 'User',
    };

    return modelMap[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
}

export default checkOwnershipOrPermission;

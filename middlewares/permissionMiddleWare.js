/**
 * Structured permission middleware for Enterprise RBAC.
 * Uses req.models (from tenantResolver) instead of static User import.
 * Checks hierarchical role levels and structured resource/action permissions.
 *
 * @param {string} resource - Resource name (e.g., 'products', 'orders', 'categories')
 * @param {string} action - Action name (e.g., 'read', 'write', 'delete', 'approve')
 * @returns {Function} Express middleware function
 */
const checkPermission = (resource, action) => async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    try {
        const { User } = req.models;

        // Fetch user from DB and populate their role to get the latest permissions
        const user = await User.findById(req.user.id).populate("role").lean();

        if (!user || !user.role) {
            return res.status(403).json({ error: "Access denied. No role assigned." });
        }

        // Name-based bypass: owner and store_admin always have full access
        const roleName = (user.role.name || '').toLowerCase();
        if (roleName === 'owner' || roleName === 'store_admin') {
            return next();
        }

        // Level-based bypass: level >= 90 bypasses permission checks
        if (user.role.level && user.role.level >= 90) {
            return next();
        }

        const { permissions } = user.role;

        if (!permissions || !Array.isArray(permissions)) {
            return res.status(403).json({
                error: "Access denied. You do not have the required permissions.",
            });
        }

        // Check structured permission: find a permission entry matching the resource and action
        const hasPermission = permissions.some(
            (p) => p.resource === resource && p.actions && p.actions.includes(action)
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: `Access denied. Required: ${action}:${resource}`,
            });
        }

        next();
    } catch (error) {
        console.error("Permission check error:", error);
        res.status(500).json({ error: "Internal server error during permission check." });
    }
};

export default checkPermission;

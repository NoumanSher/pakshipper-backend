import User from "../models/user-schema.js";

const checkPermission = (permission) => async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    try {
        // Fetch user from DB and populate their role to get the latest permissions
        const user = await User.findById(req.user.id).populate("role");

        if (!user || !user.role) {
            return res.status(403).json({ error: "Access denied. Role not found." });
        }

        const { permissions, name: roleName } = user.role;

        // Admin bypass
        if (roleName === "admin" || (permissions && permissions.includes("all"))) {
            return next();
        }

        if (!permissions || !permissions.includes(permission)) {
            return res.status(403).json({
                error: "Access denied. You do not have the required permissions.",
            });
        }

        next();
    } catch (error) {
        console.error("Permission check error:", error);
        res.status(500).json({ error: "Internal server error during permission check." });
    }
};

export default checkPermission;

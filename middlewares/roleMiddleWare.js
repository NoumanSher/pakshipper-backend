const roleMiddleware = (roleName) => (req, res, next) => {
    if (!req.user || req.user.role !== roleName) {
        return res.status(403).json({ error: 'Access denied. You do not have the required permissions.' });
    }
    next();
};

export default roleMiddleware;

import jwt from 'jsonwebtoken';
import { getPlatformConnection } from '../config/platformConnection.js';

/**
 * Middleware to authenticate platform admin requests (Super Admin Panel).
 * Verifies the JWT and loads the PlatformAdmin profile from the Master Database.
 * Attaches the platformAdmin object to req.platformAdmin.
 */
const platformAuth = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No platform token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.PLATFORM_JWT_SECRET || process.env.SECRET_KEY || 'platform-default-secret');
        
        // Get the platform DB connection
        const platformDb = getPlatformConnection();
        const PlatformAdmin = platformDb.model('PlatformAdmin');
        
        const platformAdmin = await PlatformAdmin.findById(decoded.id).select('-password').lean();
        
        if (!platformAdmin) {
            return res.status(401).json({ error: 'Platform admin not found.' });
        }

        if (!platformAdmin.isActive) {
            return res.status(403).json({ error: 'Platform admin account is suspended.' });
        }

        req.platformAdmin = platformAdmin;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Platform token expired.', expired: true });
        }
        res.status(401).json({ error: 'Invalid platform token.' });
    }
};

export default platformAuth;

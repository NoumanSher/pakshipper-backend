import User from '../../models/user-schema.js';

/**
 * Get the current authenticated user via JWT
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });
    const user = await User.findById(userId, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ message: 'login successfully', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

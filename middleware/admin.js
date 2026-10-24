const User = require('../models/User');

// Admin access is decided by the database on every request, never by the login token
const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const user = await User.findById(req.user.userId).select('role isBanned');
    if (!user || user.isBanned || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error('admin check error:', err.message);
    return res.status(500).json({ error: 'Could not check admin access' });
  }
};

module.exports = adminMiddleware;
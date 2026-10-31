const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Every logged in user is treated as a normal customer here, admins included.
// Admin powers live only behind middleware/admin.js, which checks the database itself.
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('isBanned passwordChangedAt');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Tokens issued before the last password change are no longer valid.
    // iat is in seconds, so the comparison is done in seconds too.
    if (
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      return res.status(401).json({ error: 'Password was changed. Please log in again.' });
    }

    req.user = { ...decoded, role: 'user' };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
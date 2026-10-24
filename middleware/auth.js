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

    const user = await User.findById(decoded.userId).select('isBanned');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    req.user = { ...decoded, role: 'user' };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;
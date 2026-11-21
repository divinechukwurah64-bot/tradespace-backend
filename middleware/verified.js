const User = require('../models/User');

// Use after middleware/auth.js. Blocks accounts whose email has not been verified yet.
// Accounts created before verification existed have no stored value and count as verified.
const verifiedMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('emailVerified');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        error: 'Please verify your email address first. Open the yellow banner at the top of the page.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    next();
  } catch (err) {
    console.error('verified middleware error:', err.message);
    return res.status(500).json({ error: 'Could not check your account' });
  }
};

module.exports = verifiedMiddleware;
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const authMiddleware = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

const RESET_TOKEN_MS = 60 * 60 * 1000;
const RESET_REQUEST_GAP_MS = 60 * 1000;
const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, we have sent a password reset link. Check your inbox and spam folder.';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ---------- Rate limits (per IP) ----------

const makeLimiter = (windowMs, max, message, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { error: message }
  });

// Only failed logins count, so normal users are never slowed down
const loginLimiter = makeLimiter(
  15 * 60 * 1000,
  20,
  'Too many login attempts. Please wait 15 minutes and try again.',
  true
);
const registerLimiter = makeLimiter(
  60 * 60 * 1000,
  30,
  'Too many sign-up attempts. Please try again later.'
);
const forgotLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  'Too many requests. Please wait 15 minutes and try again.'
);
const resetLimiter = makeLimiter(
  15 * 60 * 1000,
  10,
  'Too many attempts. Please wait 15 minutes and try again.'
);

// Failed emails are saved to the errorlogs collection so you can see them
const logEmailFailure = async (err, req) => {
  const reference = crypto.randomBytes(3).toString('hex').toUpperCase();
  console.error(`[EMAIL ERROR ${reference}]`, err.message);
  try {
    await ErrorLog.create({
      reference,
      message: String(err.message).slice(0, 1000),
      method: req.method,
      path: req.originalUrl,
      source: 'email'
    });
  } catch (e) {
    console.error('Could not save email error log:', e.message);
  }
};

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { fullName, email, password, phone, acceptedTerms } = req.body;

    if (!isNonEmptyString(fullName) || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Password is too long' });
    }
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions' });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      fullName: fullName.trim(),
      email: cleanEmail,
      password,
      phone: typeof phone === 'string' ? phone.trim() : undefined,
      acceptedTermsAt: new Date()
    });

    try {
      await user.save();
    } catch (saveErr) {
      // Two sign-ups with the same email at the same moment
      if (saveErr && saveErr.code === 11000) {
        return res.status(400).json({ error: 'User already exists' });
      }
      throw saveErr;
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, profileImage: user.profileImage }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        sellerRating: user.sellerRating
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FORGOT PASSWORD - always answers the same way, so nobody can find out who has an account
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordResetExpires');

    if (user && !user.isBanned) {
      // If a link was sent in the last minute, do not send another one
      const recentlyRequested =
        user.passwordResetExpires &&
        user.passwordResetExpires.getTime() - Date.now() > RESET_TOKEN_MS - RESET_REQUEST_GAP_MS;

      if (!recentlyRequested) {
        const token = crypto.randomBytes(32).toString('hex');
        user.passwordResetTokenHash = hashToken(token);
        user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MS);
        await user.save();

        const link = `${frontendBaseUrl()}/reset-password?token=${token}`;

        try {
          await sendEmail({
            to: user.email,
            subject: 'Reset your TradeSpace password',
            text:
              `Hi ${user.fullName},\n\n` +
              `We got a request to reset your TradeSpace password. Open this link to choose a new one:\n${link}\n\n` +
              `The link works for 1 hour. If you did not ask for this, you can ignore this email and your password will stay the same.`,
            html:
              `<p>Hi ${escapeHtml(user.fullName)},</p>` +
              `<p>We got a request to reset your TradeSpace password. Click the button below to choose a new one.</p>` +
              `<p><a href="${link}" style="background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Reset password</a></p>` +
              `<p>Or paste this link into your browser:<br>${link}</p>` +
              `<p>The link works for 1 hour. If you did not ask for this, you can ignore this email and your password will stay the same.</p>`
          });
        } catch (mailErr) {
          await logEmailFailure(mailErr, req);
        }
      }
    }

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// RESET PASSWORD - needs the token from the email.
// Saving the new password also sets passwordChangedAt (see models/User.js),
// which logs the account out on every other device.
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== 'string' || !token || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Password is too long' });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    user.password = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ME - the logged in person's own details. Admin status is never revealed here.
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -role -passwordChangedAt');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
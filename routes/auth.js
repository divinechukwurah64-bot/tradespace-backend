const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const authMiddleware = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

const RESET_TOKEN_MS = 60 * 60 * 1000;
const RESET_REQUEST_GAP_MS = 60 * 1000;
const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, we have sent a password reset link. Check your inbox and spam folder.';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, acceptedTerms } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = new User({
      fullName,
      email,
      password,
      phone,
      acceptedTermsAt: new Date()
    });
    await user.save();
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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
router.post('/forgot-password', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
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

// RESET PASSWORD - needs the token from the email
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== 'string' || !token || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > 128) {
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
    const user = await User.findById(req.user.userId).select('-password -role');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
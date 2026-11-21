const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
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

const VERIFY_CODE_MS = 15 * 60 * 1000;
const VERIFY_RESEND_GAP_MS = 60 * 1000;
const VERIFY_MAX_ATTEMPTS = 5;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common throwaway email services. This list is not complete, it only stops the most used ones.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamailblock.com', 'grr.la', 'sharklasers.com', 'spam4.me',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'tempmailo.com', 'tempail.com', 'tempinbox.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'trashmail.com', 'trashmail.net', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc',
  'throwawaymail.com', 'fakeinbox.com', 'fakemail.net', 'emailfake.com', 'mintemail.com',
  'mohmal.com', 'emailondeck.com', 'burnermail.io', 'discard.email', 'spamgourmet.com',
  'moakt.com', 'tmpmail.org', 'tmail.ws', 'mailnesia.com', 'mytemp.email', 'inboxkitten.com',
  'harakirimail.com', 'mailcatch.com', 'mailsac.com', 'tmpeml.com', 'dropmail.me'
]);

const isDisposableEmail = (email) => DISPOSABLE_DOMAINS.has(String(email).split('@')[1] || '');

if (!process.env.TURNSTILE_SECRET_KEY) {
  console.warn('SETTINGS WARNING: TURNSTILE_SECRET_KEY is not set, so the sign-up bot check is switched off.');
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// The code is tied to the account, so a leaked hash cannot be reused on another account
const hashCode = (userId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${String(userId)}:${code}`).digest('hex');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const makeCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

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

// Per logged in user, and only failed attempts count
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.user.userId),
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' }
});

// Per logged in user: at most 6 verification emails an hour
const resendVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.userId),
  message: { error: 'Too many codes requested. Please try again in an hour.' }
});

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

// Cloudflare Turnstile. If no secret is set the check is skipped, so nothing breaks before setup.
const verifyTurnstile = async (token, ip) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  if (typeof token !== 'string' || !token || token.length > 2048) return false;

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (ip) params.append('remoteip', ip);

    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      params,
      { timeout: 10000 }
    );
    return !!(response.data && response.data.success);
  } catch (err) {
    console.error('Turnstile check failed:', err.message);
    return false;
  }
};

// Saves a fresh 6-digit code on the account and emails it. Returns true if the email went out.
const issueVerificationCode = async (user, req) => {
  const code = makeCode();

  user.emailVerificationCodeHash = hashCode(user._id, code);
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_CODE_MS);
  user.emailVerificationAttempts = 0;
  await user.save();

  try {
    await sendEmail({
      to: user.email,
      subject: `Your TradeSpace verification code: ${code}`,
      text:
        `Hi ${user.fullName},\n\n` +
        `Your TradeSpace verification code is ${code}.\n\n` +
        `It works for 15 minutes. If you did not create a TradeSpace account, you can ignore this email.`,
      html:
        `<p>Hi ${escapeHtml(user.fullName)},</p>` +
        `<p>Your TradeSpace verification code is:</p>` +
        `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${code}</p>` +
        `<p>It works for 15 minutes. If you did not create a TradeSpace account, you can ignore this email.</p>`
    });
    return true;
  } catch (mailErr) {
    await logEmailFailure(mailErr, req);
    return false;
  }
};

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { fullName, email, password, phone, acceptedTerms, turnstileToken } = req.body;

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
    if (isDisposableEmail(cleanEmail)) {
      return res.status(400).json({
        error: 'Please use a permanent email address. Temporary email services are not allowed.'
      });
    }

    if (!(await verifyTurnstile(turnstileToken, req.ip))) {
      return res.status(400).json({ error: 'Please complete the human check and try again' });
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
      acceptedTermsAt: new Date(),
      emailVerified: false
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

    const verificationSent = await issueVerificationCode(user, req);

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'User registered successfully',
      token,
      verificationSent,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        emailVerified: false
      }
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
        sellerRating: user.sellerRating,
        emailVerified: user.emailVerified !== false
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFY EMAIL - the 6-digit code from the email
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const code = req.body && req.body.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-digit code from your email' });
    }

    const user = await User.findById(req.user.userId).select(
      '+emailVerificationCodeHash +emailVerificationExpires +emailVerificationAttempts'
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified !== false) {
      return res.json({ verified: true });
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    }

    if ((user.emailVerificationAttempts || 0) >= VERIFY_MAX_ATTEMPTS) {
      return res.status(400).json({ error: 'Too many wrong tries. Request a new code.' });
    }

    if (!safeEqual(hashCode(user._id, code), user.emailVerificationCodeHash)) {
      user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ error: 'That code is not correct' });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpires = null;
    user.emailVerificationAttempts = 0;
    await user.save();

    res.json({ verified: true });
  } catch (err) {
    console.error('POST /auth/verify-email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SEND A NEW VERIFICATION CODE
router.post('/resend-verification', authMiddleware, resendVerifyLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('+emailVerificationExpires');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified !== false) {
      return res.json({ verified: true });
    }

    // If a code was sent in the last minute, do not send another one
    const recentlySent =
      user.emailVerificationExpires &&
      user.emailVerificationExpires.getTime() - Date.now() > VERIFY_CODE_MS - VERIFY_RESEND_GAP_MS;

    if (recentlySent) {
      return res.status(429).json({
        error: 'A code was just sent. Please wait a minute before asking for another one.',
        code: 'WAIT'
      });
    }

    const sent = await issueVerificationCode(user, req);
    if (!sent) {
      return res.status(503).json({ error: 'We could not send the email right now. Please try again in a few minutes.' });
    }

    res.json({ sent: true });
  } catch (err) {
    console.error('POST /auth/resend-verification error:', err);
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

// CHANGE PASSWORD - for a logged in person who knows their current password.
// Saving sets passwordChangedAt, which logs every other device out. This device gets a fresh token
// so the person stays logged in here.
router.post('/change-password', authMiddleware, changePasswordLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Enter your current password and a new one' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'New password is too long' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'Your new password must be different from the current one' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(403).json({ error: 'Your current password is incorrect' });
    }

    user.password = newPassword;
    // Any reset link sent earlier stops working
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Password changed', token });
  } catch (err) {
    console.error('POST /auth/change-password error:', err);
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
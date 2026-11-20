const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const KINDS = ['auction', 'gig', 'profile'];
const URL_LIFETIME_SECONDS = 300;

const R2_SETTINGS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_URL'
];

let client = null;

const r2IsConfigured = () => R2_SETTINGS.every((name) => !!process.env[name]);

const getClient = () => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      },
      // Newer SDK versions add checksum headers that R2 browser uploads reject
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    });
  }
  return client;
};

// Per logged in user, not per IP
const signLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.userId),
  message: { error: 'Too many uploads. Please try again later.' }
});

// POST /api/uploads/sign
// Body: { kind: 'auction' | 'gig' | 'profile', contentType: 'image/jpeg' }
// Returns a one-time link the browser uploads the photo to, and the final public address.
router.post('/sign', authMiddleware, signLimiter, async (req, res) => {
  try {
    if (!r2IsConfigured()) {
      return res.status(503).json({ error: 'Photo storage is not set up' });
    }

    const kind = req.body && req.body.kind;
    const contentType = req.body && req.body.contentType;

    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: 'Invalid upload type' });
    }
    if (contentType !== 'image/jpeg') {
      return res.status(400).json({ error: 'Only JPG photos can be uploaded' });
    }

    const key = `${kind}/${req.user.userId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.jpg`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: 'image/jpeg'
    });

    const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: URL_LIFETIME_SECONDS });
    const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;

    return res.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error('Upload sign error:', err.message);
    return res.status(500).json({ error: 'Could not prepare the upload' });
  }
});

module.exports = router;
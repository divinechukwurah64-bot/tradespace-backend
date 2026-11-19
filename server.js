require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const socketIO = require('socket.io');
const User = require('./models/User');
const ErrorLog = require('./models/ErrorLog');
const { startPaymentJobs } = require('./utils/payments');

// ---------- Settings check ----------

const isProduction =
  process.env.NODE_ENV === 'production' ||
  !!process.env.RAILWAY_ENVIRONMENT_NAME ||
  !!process.env.RAILWAY_ENVIRONMENT;

const REQUIRED_SETTINGS = ['MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'];
const missingRequired = REQUIRED_SETTINGS.filter((name) => !process.env[name]);

if (missingRequired.length) {
  console.error(`Missing required settings: ${missingRequired.join(', ')}. The server will not start.`);
  process.exit(1);
}

const settingWarnings = [];
if (process.env.JWT_SECRET.length < 32) {
  settingWarnings.push('JWT_SECRET is shorter than 32 characters. Use a longer random value.');
}
if (!process.env.PAYSTACK_SECRET_KEY) {
  settingWarnings.push('PAYSTACK_SECRET_KEY is not set, so payments will not work.');
} else if (isProduction && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) {
  settingWarnings.push('PAYSTACK_SECRET_KEY is a TEST key while running in production.');
}
if (!/^[0-9a-fA-F]{64}$/.test(process.env.BANK_ENCRYPTION_KEY || '')) {
  settingWarnings.push('BANK_ENCRYPTION_KEY is missing or not 64 hex characters, so seller account numbers cannot be stored.');
}
if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
  settingWarnings.push('Neither BREVO_API_KEY nor RESEND_API_KEY is set, so emails will not be sent.');
}
if (process.env.BREVO_API_KEY && process.env.RESEND_API_KEY) {
  settingWarnings.push('Both BREVO_API_KEY and RESEND_API_KEY are set. Resend wins, so unset it if you use Brevo.');
}
if (!process.env.MAIL_FROM) {
  settingWarnings.push('MAIL_FROM is not set.');
}
if (!process.env.SUPPORT_EMAIL) {
  settingWarnings.push('SUPPORT_EMAIL is not set.');
}
if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  settingWarnings.push('LiveKit settings are incomplete, so live streams will not work.');
}
if (
  !process.env.R2_ACCOUNT_ID ||
  !process.env.R2_ACCESS_KEY_ID ||
  !process.env.R2_SECRET_ACCESS_KEY ||
  !process.env.R2_BUCKET ||
  !process.env.R2_PUBLIC_URL
) {
  settingWarnings.push('Cloudflare R2 settings are incomplete, so photo uploads will not work.');
}
if (isProduction && /localhost|127\.0\.0\.1/i.test(process.env.FRONTEND_URL)) {
  settingWarnings.push('FRONTEND_URL includes localhost while running in production.');
}
for (const warning of settingWarnings) {
  console.warn(`SETTINGS WARNING: ${warning}`);
}

const app = express();
const server = http.createServer(app);

// Railway puts one proxy in front of the app. Without this, every request
// looks like it comes from the same IP and rate limits would hit everyone at once.
app.set('trust proxy', 1);

// ---------- Error logging ----------

const GENERIC_MESSAGE =
  'Sorry, something went wrong on our side. Please try again later or contact support.';

const makeReference = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const friendlyMessage = (reference) => `${GENERIC_MESSAGE} (Ref: ${reference})`;

// Saves the real error for you. Never logs request bodies, so passwords are not stored.
const logError = async ({ reference, message, stack, req, statusCode, source }) => {
  console.error(
    `[ERROR ${reference}] ${source || 'api'}`,
    req ? `${req.method} ${req.originalUrl}` : '',
    message
  );
  if (stack) console.error(stack);

  try {
    await ErrorLog.create({
      reference,
      message: String(message || 'Unknown error').slice(0, 1000),
      stack: stack ? String(stack).slice(0, 4000) : null,
      method: req ? req.method : null,
      path: req ? req.originalUrl : null,
      statusCode: statusCode || null,
      userId: req && req.user ? req.user.userId : null,
      ip: req ? req.ip : null,
      source: source || 'api'
    });
  } catch (e) {
    console.error('Could not save error log:', e.message);
  }
};

process.on('unhandledRejection', (reason) => {
  logError({
    reference: makeReference(),
    message: reason && reason.message ? reason.message : String(reason),
    stack: reason && reason.stack,
    source: 'process'
  });
});

process.on('uncaughtException', (err) => {
  logError({
    reference: makeReference(),
    message: err.message,
    stack: err.stack,
    source: 'process'
  });
  // The process is in an unknown state, so exit and let Railway restart it
  setTimeout(() => process.exit(1), 2000);
});

// ---------- Security headers ----------

// cross-origin is needed so the Vercel frontend can read responses from this API
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// ---------- Health check ----------
// Answers 200 only when the database really responds. Monitors and Railway can use it.
// It sits before the rate limit, so frequent checks are never blocked.

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

app.get('/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }

  try {
    await withTimeout(mongoose.connection.db.command({ ping: 1 }), 2500);
    return res.json({ status: 'ok', database: 'connected', uptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    return res.status(503).json({ status: 'unavailable', database: 'not responding' });
  }
});

// ---------- CORS ----------

// FRONTEND_URL can hold one or more origins, comma separated:
// https://your-app.vercel.app,https://yourdomain.com
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || '').split(','),
  'http://localhost:3000'
]
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

const originCheck = (origin, callback) => {
  // Requests with no origin (Postman, curl, server-to-server) are allowed
  if (!origin) return callback(null, true);

  const clean = origin.replace(/\/+$/, '');

  if (allowedOrigins.includes(clean)) return callback(null, true);

  if (allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(clean)) {
    return callback(null, true);
  }

  console.log('CORS blocked origin:', origin);
  return callback(null, false);
};

const corsOptions = {
  origin: originCheck,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

const io = socketIO(server, {
  cors: {
    origin: originCheck,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---------- General rate limit ----------
// A safety net for the whole API: 300 requests a minute per IP. Routes keep their own, tighter limits.
// The Paystack webhook is exempt, because Paystack can send bursts and retries.
// These counters live in this process. That is fine for one server. If you ever run more than one,
// move them to a shared store such as Redis.

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith('/api/payments/webhook'),
  message: { error: 'Too many requests. Please slow down and try again in a minute.' }
});

app.use('/api', apiLimiter);

// The raw body is kept so the Paystack webhook signature can be checked
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
// extended: false stops nested objects in form bodies
app.use(express.urlencoded({ extended: false }));

// Any response with a 5xx status is logged for you and replaced with a friendly message
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && !body.reference) {
      const reference = makeReference();
      logError({
        reference,
        message: body.error || 'Unknown server error',
        req,
        statusCode: res.statusCode,
        source: 'api'
      });
      return originalJson({ error: friendlyMessage(reference), reference });
    }
    return originalJson(body);
  };

  next();
});

// ---------- Database ----------

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('MongoDB connected');
    startPaymentJobs();
  })
  .catch((err) => {
    // Without a database the site cannot work. Exit so Railway restarts the server
    // and the deploy shows as failed, instead of leaving a half-working server running.
    console.error('MongoDB connection error:', err.message);
    setTimeout(() => process.exit(1), 1000);
  });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/gigs', require('./routes/gigs'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/live', require('./routes/live'));
app.use('/api/users', require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));
app.use('/api/uploads', require('./routes/uploads'));

// Identify the user on connect. Visitors without a valid token still connect,
// but as anonymous: they can watch auctions and never join a user room.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('isBanned passwordChangedAt');

    const tokenIsOld =
      user &&
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);

    if (user && !user.isBanned && !tokenIsOld) {
      socket.userId = decoded.userId.toString();
    }
    return next();
  } catch (err) {
    return next();
  }
});

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id, socket.userId ? '(logged in)' : '(anonymous)');

  // Private room named with the user id. routes/messages.js sends to this room.
  if (socket.userId) {
    socket.join(socket.userId);
  }

  socket.on('join:auction', (auctionId) => {
    if (typeof auctionId !== 'string' || !auctionId || auctionId.length > 64) return;
    socket.join(`auction:${auctionId}`);
  });

  socket.on('leave:auction', (auctionId) => {
    if (typeof auctionId !== 'string' || !auctionId || auctionId.length > 64) return;
    socket.leave(`auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);

// Catches errors thrown outside the route try/catch blocks (bad JSON, middleware crashes)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    const reference = makeReference();
    logError({
      reference,
      message: err.message,
      stack: err.stack,
      req,
      statusCode: status,
      source: 'api'
    });
    return res.status(status).json({ error: friendlyMessage(reference), reference });
  }

  res.status(status).json({
    error: status === 400 ? 'Invalid request' : 'Your request could not be completed'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
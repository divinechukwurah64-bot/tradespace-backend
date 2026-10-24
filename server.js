const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const socketIO = require('socket.io');
const User = require('./models/User');
const ErrorLog = require('./models/ErrorLog');
const { startPaymentJobs } = require('./utils/payments');

dotenv.config();

const app = express();
const server = http.createServer(app);

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

// The raw body is kept so the Paystack webhook signature can be checked
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true }));

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

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connected');
  startPaymentJobs();
})
.catch(err => console.log('MongoDB connection error:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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

// Identify the user on connect. Visitors without a valid token still connect,
// but as anonymous: they can watch auctions and never join a user room.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('isBanned');

    if (user && !user.isBanned) {
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
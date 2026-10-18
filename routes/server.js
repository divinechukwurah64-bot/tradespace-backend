const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
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

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join:auction', (auctionId) => {
    socket.join(`auction:${auctionId}`);
  });

  socket.on('leave:auction', (auctionId) => {
    socket.leave(`auction:${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://tradespace-frontend-j57c-1sr3h9u75.vercel.app',
    'https://tradespace-frontend-j57c-h7xmkcnq2.vercel.app'
  ],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/gigs', require('./routes/gigs'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/transactions', require('./routes/transactions'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'TradeSpace API is running' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
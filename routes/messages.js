const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const authMiddleware = require('../middleware/auth');

const MAX_LENGTH = 2000;
const MAX_CONVERSATION_MESSAGES = 200;

// Only plain 24 character id strings count. Objects and numbers are refused.
const OBJECT_ID = /^[a-f\d]{24}$/i;
const isId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

const provided = (value) => value !== undefined && value !== null && value !== '';

// Simple limit on how fast one person can send messages
const SEND_LIMIT = 20;
const SEND_WINDOW_MS = 60 * 1000;
const hits = new Map();

const limited = (key) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < SEND_WINDOW_MS);
  if (recent.length >= SEND_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
};

// Clears old entries so the list does not grow forever
setInterval(() => {
  const cutoff = Date.now() - SEND_WINDOW_MS;
  for (const [key, times] of hits) {
    if (!times.length || times[times.length - 1] < cutoff) {
      hits.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, auctionId, gigId } = req.body;

    if (!receiverId || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Receiver and content required' });
    }

    if (!isId(receiverId)) {
      return res.status(400).json({ error: 'Invalid receiver' });
    }

    const text = content.trim();
    if (text.length > MAX_LENGTH) {
      return res.status(400).json({ error: `Message cannot be longer than ${MAX_LENGTH} characters` });
    }

    if (receiverId.toLowerCase() === String(req.user.userId).toLowerCase()) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

    if (provided(auctionId) && !isId(auctionId)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }
    if (provided(gigId) && !isId(gigId)) {
      return res.status(400).json({ error: 'Invalid gig' });
    }

    if (limited(`msg:${req.user.userId}`)) {
      return res.status(429).json({ error: 'You are sending messages too fast. Please wait a moment.' });
    }

    const receiver = await User.findById(receiverId).select('_id isBanned');
    if (!receiver || receiver.isBanned) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (provided(auctionId) && !(await Auction.exists({ _id: auctionId }))) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    if (provided(gigId) && !(await Gig.exists({ _id: gigId }))) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const message = new Message({
      senderId: req.user.userId,
      receiverId,
      content: text,
      auctionId: provided(auctionId) ? auctionId : null,
      gigId: provided(gigId) ? gigId : null
    });

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('message:new', {
        _id: message._id,
        senderId: req.user.userId,
        content: text,
        timestamp: message.createdAt
      });
    }

    res.status(201).json({
      message: 'Message sent',
      data: message
    });
  } catch (err) {
    console.error('POST /messages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// The latest messages between me and one other person, oldest first
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    if (!isId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.userId }
      ]
    })
      .populate('senderId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(MAX_CONVERSATION_MESSAGES);

    res.json(messages.reverse());
  } catch (err) {
    console.error('GET /messages/conversation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/user/conversations', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId },
        { receiverId: req.user.userId }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(messages);
  } catch (err) {
    console.error('GET /messages/user/conversations error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const MAX_LENGTH = 2000;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, auctionId, gigId } = req.body;

    if (!receiverId || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Receiver and content required' });
    }

    const text = content.trim();
    if (text.length > MAX_LENGTH) {
      return res.status(400).json({ error: `Message cannot be longer than ${MAX_LENGTH} characters` });
    }

    if (!mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({ error: 'Invalid receiver' });
    }

    if (receiverId.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

    const receiver = await User.findById(receiverId).select('_id');
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const message = new Message({
      senderId: req.user.userId,
      receiverId,
      content: text,
      auctionId: auctionId || null,
      gigId: gigId || null
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

router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.userId }
      ]
    })
      .populate('senderId', 'fullName')
      .sort({ createdAt: 1 });

    res.json(messages);
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
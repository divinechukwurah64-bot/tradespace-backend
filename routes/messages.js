const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiverId, content, auctionId, gigId } = req.body;
    
    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver and content required' });
    }
    
    const message = new Message({
      senderId: req.user.userId,
      receiverId,
      content,
      auctionId: auctionId || null,
      gigId: gigId || null
    });
    
    await message.save();
    
    const io = req.app.get('io');
    io.to(receiverId).emit('message:new', {
      _id: message._id,
      senderId: req.user.userId,
      content,
      timestamp: message.createdAt
    });
    
    res.status(201).json({
      message: 'Message sent',
      data: message
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
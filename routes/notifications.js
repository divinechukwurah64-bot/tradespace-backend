const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// MY NOTIFICATIONS
router.get('/', auth, async (req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ userId: req.user.userId, readAt: null })
    ]);
    res.json({ items, unreadCount });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MARK ALL AS READ
router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('POST /notifications/read-all error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MARK ONE AS READ
router.post('/:id/read', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification' });
    }
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user.userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('POST /notifications/:id/read error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
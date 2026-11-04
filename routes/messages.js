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
const MAX_INBOX_ROWS = 50;
const PREVIEW_LENGTH = 120;
const MAX_BLOCKED = 200;

// Only plain 24 character id strings count. Objects and numbers are refused.
const OBJECT_ID = /^[a-f\d]{24}$/i;
const isId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

const provided = (value) => value !== undefined && value !== null && value !== '';

const includesId = (list, id) => (list || []).some((item) => String(item) === String(id));

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

    const [receiver, sender] = await Promise.all([
      User.findById(receiverId).select('_id isBanned +blockedUsers'),
      User.findById(req.user.userId).select('+blockedUsers')
    ]);

    if (!receiver || receiver.isBanned) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (sender && includesId(sender.blockedUsers, receiver._id)) {
      return res.status(403).json({
        error: 'You blocked this person. Unblock them to send a message.',
        code: 'BLOCKED_BY_ME'
      });
    }

    // The same message whether or not they blocked you, so it is not revealed
    if (includesId(receiver.blockedUsers, req.user.userId)) {
      return res.status(403).json({ error: 'You cannot message this person.' });
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

// HOW MANY UNREAD MESSAGES I HAVE - for the badge in the navbar
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiverId: req.user.userId, isRead: false });
    res.json({ count });
  } catch (err) {
    console.error('GET /messages/unread-count error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MY INBOX - one row per person, newest first, with the last message and an unread count
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user.userId);

    const rows = await Message.aggregate([
      { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$senderId', me] }, '$receiverId', '$senderId'] },
          lastMessage: { $first: '$content' },
          lastAt: { $first: '$createdAt' },
          lastFromMe: { $first: { $eq: ['$senderId', me] } },
          unread: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$receiverId', me] }, { $eq: ['$isRead', false] }] }, 1, 0]
            }
          }
        }
      },
      { $sort: { lastAt: -1 } },
      { $limit: MAX_INBOX_ROWS }
    ]);

    const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('fullName profileImage');
    const byId = new Map(users.map((u) => [String(u._id), u]));

    res.json(
      rows.map((r) => {
        const person = byId.get(String(r._id));
        return {
          userId: r._id,
          fullName: person ? person.fullName : 'Deleted user',
          profileImage: person ? person.profileImage || null : null,
          lastMessage: String(r.lastMessage || '').slice(0, PREVIEW_LENGTH),
          lastAt: r.lastAt,
          lastFromMe: !!r.lastFromMe,
          unread: r.unread
        };
      })
    );
  } catch (err) {
    console.error('GET /messages/inbox error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WHO AM I TALKING TO - the name and picture at the top of a conversation,
// and whether I have blocked them. It never says whether they blocked me.
router.get('/partner/:userId', authMiddleware, async (req, res) => {
  try {
    if (!isId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const [person, me] = await Promise.all([
      User.findById(req.params.userId).select('fullName profileImage'),
      User.findById(req.user.userId).select('+blockedUsers')
    ]);

    if (!person) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id: person._id,
      fullName: person.fullName,
      profileImage: person.profileImage || null,
      blockedByMe: !!me && includesId(me.blockedUsers, person._id)
    });
  } catch (err) {
    console.error('GET /messages/partner error:', err);
    res.status(500).json({ error: err.message });
  }
});

// BLOCK SOMEONE - neither of you can message the other. Their unread messages are cleared.
router.post('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isId(userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }
    if (userId.toLowerCase() === String(req.user.userId).toLowerCase()) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const target = await User.exists({ _id: userId });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const me = await User.findById(req.user.userId).select('+blockedUsers');
    if (!me) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!includesId(me.blockedUsers, userId) && (me.blockedUsers || []).length >= MAX_BLOCKED) {
      return res.status(400).json({ error: 'You have blocked too many people. Unblock someone first.' });
    }

    await User.updateOne({ _id: req.user.userId }, { $addToSet: { blockedUsers: userId } });
    await Message.updateMany(
      { senderId: userId, receiverId: req.user.userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ blocked: true });
  } catch (err) {
    console.error('POST /messages/block error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UNBLOCK SOMEONE
router.delete('/block/:userId', authMiddleware, async (req, res) => {
  try {
    if (!isId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    await User.updateOne({ _id: req.user.userId }, { $pull: { blockedUsers: req.params.userId } });
    res.json({ blocked: false });
  } catch (err) {
    console.error('DELETE /messages/block error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PEOPLE I HAVE BLOCKED
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId).select('+blockedUsers');
    const ids = me ? me.blockedUsers || [] : [];

    const people = ids.length
      ? await User.find({ _id: { $in: ids } }).select('fullName profileImage')
      : [];

    res.json(
      people.map((p) => ({ _id: p._id, fullName: p.fullName, profileImage: p.profileImage || null }))
    );
  } catch (err) {
    console.error('GET /messages/blocked error:', err);
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

// MARK A CONVERSATION AS READ - only messages sent to me by that person
router.post('/conversation/:userId/read', authMiddleware, async (req, res) => {
  try {
    if (!isId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    await Message.updateMany(
      { senderId: req.params.userId, receiverId: req.user.userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('POST /messages/conversation/read error:', err);
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
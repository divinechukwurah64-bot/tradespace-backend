const express = require('express');
const User = require('../models/User');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// Every route in this file requires a logged-in admin
router.use(auth, admin);

// DASHBOARD STATS
router.get('/stats', async (req, res) => {
  try {
    const [users, bannedUsers, activeAuctions, totalAuctions] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBanned: true }),
      Auction.countDocuments({ status: 'active' }),
      Auction.countDocuments()
    ]);
    res.json({ users, bannedUsers, activeAuctions, totalAuctions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIST USERS (optional ?search=)
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? {
          $or: [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      : {};
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BAN / UNBAN USER
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot ban yourself' });
    }
    if (target.role === 'admin') {
      return res.status(400).json({ error: 'You cannot ban another admin' });
    }
    target.isBanned = !target.isBanned;
    await target.save();
    res.json({ _id: target._id, isBanned: target.isBanned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIST ALL AUCTIONS (optional ?status=active|ended|sold)
router.get('/auctions', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const auctions = await Auction.find(filter)
      .populate('sellerId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FORCE END AN AUCTION
router.patch('/auctions/:id/end', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    auction.status = 'ended';
    auction.endsAt = new Date();
    await auction.save();
    res.json({ _id: auction._id, status: auction.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE AN AUCTION (admin can remove even if it has bids)
router.delete('/auctions/:id', async (req, res) => {
  try {
    const auction = await Auction.findByIdAndDelete(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    res.json({ message: 'Auction removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
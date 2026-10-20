const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Auction = require('../models/Auction');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');

const router = express.Router();

const SELLER_FIELDS = 'fullName email phone';
const BIDDER_FIELDS = 'fullName email';

const loadAuction = (id) =>
  Auction.findById(id)
    .populate('sellerId', SELLER_FIELDS)
    .populate('bids.bidderId', BIDDER_FIELDS);

// Reads the user id from the token if there is one, without requiring a login
const optionalUserId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch (err) {
    return null;
  }
};

// GET ALL AUCTIONS
router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('sellerId', SELLER_FIELDS)
      .populate('bids.bidderId', BIDDER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    console.error('GET /auctions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET LIKES AND COMMENTS FOR ONE AUCTION (public)
router.get('/:id/social', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const userId = optionalUserId(req);

    const [likeCount, likedDoc, commentCount, comments] = await Promise.all([
      Like.countDocuments({ auctionId: id }),
      userId ? Like.exists({ auctionId: id, userId }) : null,
      Comment.countDocuments({ auctionId: id }),
      Comment.find({ auctionId: id })
        .populate('userId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    res.json({ likeCount, liked: !!likedDoc, commentCount, comments });
  } catch (err) {
    console.error('GET /auctions/:id/social error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIKE / UNLIKE AN AUCTION - Auth required
router.post('/:id/like', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const exists = await Auction.exists({ _id: id });
    if (!exists) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const removed = await Like.findOneAndDelete({ auctionId: id, userId: req.user.userId });

    let liked = false;
    if (!removed) {
      try {
        await Like.create({ auctionId: id, userId: req.user.userId });
        liked = true;
      } catch (e) {
        // A double click can hit the unique index. That just means it is already liked.
        if (e.code === 11000) liked = true;
        else throw e;
      }
    }

    const likeCount = await Like.countDocuments({ auctionId: id });
    res.json({ liked, likeCount });
  } catch (err) {
    console.error('POST /auctions/:id/like error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST A COMMENT - Auth required
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const text = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!text) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'Comment cannot be longer than 500 characters' });
    }

    const exists = await Auction.exists({ _id: id });
    if (!exists) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const recent = await Comment.countDocuments({
      auctionId: id,
      userId: req.user.userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) }
    });
    if (recent >= 5) {
      return res.status(429).json({ error: 'You are commenting too fast. Please wait a moment.' });
    }

    const comment = await Comment.create({
      auctionId: id,
      userId: req.user.userId,
      content: text
    });

    const populated = await Comment.findById(comment._id).populate('userId', 'fullName');
    res.status(201).json(populated);
  } catch (err) {
    console.error('POST /auctions/:id/comments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE A COMMENT - the author, the auction seller, or an admin
router.delete('/:id/comments/:commentId', auth, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const comment = await Comment.findOne({ _id: commentId, auctionId: id });
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const auction = await Auction.findById(id).select('sellerId');
    const isAuthor = comment.userId.toString() === req.user.userId;
    const isSeller = !!auction && auction.sellerId.toString() === req.user.userId;

    if (!isAuthor && !isSeller && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You cannot delete this comment' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('DELETE /auctions/:id/comments/:commentId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE AUCTION
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('sellerId', SELLER_FIELDS)
      .populate('bids.bidderId', BIDDER_FIELDS)
      .populate('winnerId', BIDDER_FIELDS);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json(auction);
  } catch (err) {
    console.error('GET /auctions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE AUCTION - Auth required
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, condition, startingBid, images } = req.body;

    if (!title || !description || !startingBid || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (startingBid < 100) {
      return res.status(400).json({ error: 'Starting bid must be at least ₦100' });
    }

    const auction = new Auction({
      sellerId: req.user.userId,
      title,
      description,
      category,
      condition: condition || 'Good',
      startingBid,
      currentBid: null,
      images: images || [],
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
    });

    await auction.save();

    const populatedAuction = await loadAuction(auction._id);

    res.status(201).json(populatedAuction);
  } catch (err) {
    console.error('POST /auctions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PLACE BID - Auth required
router.post('/:id/bids', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const now = new Date();
    if (now > new Date(auction.endsAt)) {
      return res.status(400).json({ error: 'Auction has ended' });
    }

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid bid amount' });
    }

    const minimumBid = auction.currentBid || auction.startingBid;
    if (amount <= minimumBid) {
      return res.status(400).json({
        error: `Bid must be higher than ₦${minimumBid.toLocaleString()}`
      });
    }

    if (auction.sellerId.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot bid on your own auction' });
    }

    auction.currentBid = amount;
    auction.bids.push({
      bidderId: req.user.userId,
      amount,
      timestamp: new Date(),
    });

    await auction.save();

    const populatedAuction = await loadAuction(auction._id);

    res.json(populatedAuction);
  } catch (err) {
    console.error('POST /auctions/:id/bids error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE AUCTION - Only seller can delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own auctions' });
    }

    if (auction.bids && auction.bids.length > 0) {
      return res.status(400).json({ error: 'Cannot delete auction with active bids' });
    }

    await Auction.findByIdAndDelete(req.params.id);
    await Promise.all([
      Like.deleteMany({ auctionId: req.params.id }),
      Comment.deleteMany({ auctionId: req.params.id })
    ]);

    res.json({ message: 'Auction deleted successfully' });
  } catch (err) {
    console.error('DELETE /auctions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE AUCTION - Only seller can update
router.put('/:id', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only update your own auctions' });
    }

    if (auction.bids && auction.bids.length > 0) {
      return res.status(400).json({ error: 'Cannot update auction with active bids' });
    }

    const { title, description, category, condition, startingBid, images } = req.body;

    if (title) auction.title = title;
    if (description) auction.description = description;
    if (category) auction.category = category;
    if (condition) auction.condition = condition;
    if (startingBid && startingBid >= 100) auction.startingBid = startingBid;
    if (images) auction.images = images;

    await auction.save();

    const populatedAuction = await loadAuction(auction._id);

    res.json(populatedAuction);
  } catch (err) {
    console.error('PUT /auctions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
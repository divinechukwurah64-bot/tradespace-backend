const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { RoomServiceClient } = require('livekit-server-sdk');
const Auction = require('../models/Auction');
const User = require('../models/User');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const notify = require('../utils/notify');
const { PAYMENT_WINDOW_MS } = require('../utils/payments');

const router = express.Router();

// Public responses never include email addresses or phone numbers
const SELLER_FIELDS = 'fullName profileImage';
const BIDDER_FIELDS = 'fullName';

const MAX_REOPENS = 3;
const AUCTION_LENGTH_MS = 24 * 60 * 60 * 1000;

const money = (n) => `₦${Number(n).toLocaleString()}`;

const loadAuction = (id) =>
  Auction.findById(id)
    .populate('sellerId', SELLER_FIELDS)
    .populate('bids.bidderId', BIDDER_FIELDS)
    .populate('winnerId', BIDDER_FIELDS);

// Works whether the value is a plain id or a populated document
const idOf = (value) => (value ? String(value._id || value) : null);

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

// Closes the live stream room when an auction is sold
const closeLiveRoom = async (auctionId) => {
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return;
  try {
    const url = process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const service = new RoomServiceClient(url, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    await service.deleteRoom(`auction-${auctionId}`);
  } catch (e) {
    console.log('closeLiveRoom note:', e.message);
  }
};

// What the person asking is allowed to know about this auction.
// Contact details are only shared between the seller and the winning bidder once the sale is paid.
const buildViewer = async (auction, userId) => {
  const viewer = { role: null, contact: null, hasReviewed: false };
  if (!userId) return viewer;

  const sellerId = idOf(auction.sellerId);
  const winnerId = idOf(auction.winnerId);

  if (userId === sellerId) viewer.role = 'seller';
  else if (winnerId && userId === winnerId) viewer.role = 'winner';

  if (auction.status === 'sold' && viewer.role) {
    const otherId = viewer.role === 'seller' ? winnerId : sellerId;
    const other = otherId ? await User.findById(otherId).select('fullName email phone') : null;
    if (other) {
      viewer.contact = {
        fullName: other.fullName,
        email: other.email,
        phone: other.phone || null
      };
    }
  }

  if (viewer.role === 'winner') {
    viewer.hasReviewed = !!(await Review.exists({ auctionId: auction._id, reviewerId: userId }));
  }

  return viewer;
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = await loadAuction(req.params.id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const result = auction.toObject();
    result.viewer = await buildViewer(auction, optionalUserId(req));

    res.json(result);
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
      endsAt: new Date(Date.now() + AUCTION_LENGTH_MS),
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
    const amount = Number(req.body.amount);
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const now = new Date();
    if (auction.status !== 'active' || now > new Date(auction.endsAt)) {
      return res.status(400).json({ error: 'Auction has ended' });
    }

    if (!Number.isFinite(amount) || amount < 1) {
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

    const bidder = await User.findById(req.user.userId).select('biddingBlocked');
    if (bidder && bidder.biddingBlocked) {
      return res.status(403).json({
        error: 'You cannot bid because of unpaid wins. Please contact support.'
      });
    }

    const previousTop = (auction.bids || []).reduce(
      (top, b) => (!top || b.amount > top.amount ? b : top),
      null
    );

    auction.currentBid = amount;
    auction.bids.push({
      bidderId: req.user.userId,
      amount,
      timestamp: new Date(),
    });

    await auction.save();

    if (previousTop && previousTop.bidderId && previousTop.bidderId.toString() !== req.user.userId) {
      notify(previousTop.bidderId, {
        type: 'bid',
        title: 'You were outbid',
        message: `Someone bid ${money(amount)} on "${auction.title}".`,
        link: `/auctions/${auction._id}`
      });
    }
    notify(auction.sellerId, {
      type: 'bid',
      title: 'New bid on your auction',
      message: `${money(amount)} on "${auction.title}".`,
      link: `/auctions/${auction._id}`
    });

    const populatedAuction = await loadAuction(auction._id);

    res.json(populatedAuction);
  } catch (err) {
    console.error('POST /auctions/:id/bids error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ACCEPT A BID - Only the seller. The bidder then has 3 days to pay.
router.post('/:id/bids/:bidId/accept', auth, async (req, res) => {
  try {
    const { id, bidId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(bidId)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can accept a bid' });
    }

    if (auction.status === 'sold') {
      return res.status(400).json({ error: 'This auction has already been sold' });
    }

    if (auction.status === 'awaiting_payment') {
      return res.status(400).json({ error: 'A bid has already been accepted and is waiting for payment' });
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ error: 'This auction is closed and cannot accept bids' });
    }

    const bid = auction.bids.id(bidId);
    if (!bid || !bid.bidderId) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if ((auction.defaultedBidderIds || []).some((d) => d.toString() === bid.bidderId.toString())) {
      return res.status(400).json({ error: 'This bidder missed the payment deadline earlier' });
    }

    // We need to know where to send the money before a buyer is asked to pay
    const seller = await User.findById(req.user.userId).select('+paystackRecipientCode');
    if (!seller || !seller.paystackRecipientCode) {
      return res.status(400).json({
        error: 'Add your payout account before accepting a bid',
        code: 'PAYOUT_REQUIRED'
      });
    }

    auction.status = 'awaiting_payment';
    auction.winnerId = bid.bidderId;
    auction.winningBid = bid.amount;
    auction.currentBid = bid.amount;
    auction.paymentDueAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
    auction.paymentReminderSent = false;
    auction.endsAt = new Date();
    auction.isLive = false;
    auction.liveStartedAt = null;

    await auction.save();

    closeLiveRoom(auction._id);

    notify(bid.bidderId, {
      type: 'payment',
      title: 'You won an auction',
      message: `The seller accepted your ${money(bid.amount)} bid on "${auction.title}". Pay within 3 days.`,
      link: `/auctions/${auction._id}`
    });
    notify(auction.sellerId, {
      type: 'payment',
      title: 'Bid accepted',
      message: `Waiting for the buyer to pay ${money(bid.amount)} for "${auction.title}". They have 3 days.`,
      link: `/auctions/${auction._id}`
    });

    const populatedAuction = await loadAuction(auction._id);
    res.json(populatedAuction);
  } catch (err) {
    console.error('POST /auctions/:id/bids/:bidId/accept error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REOPEN AN EXPIRED AUCTION - Only the seller, up to 3 times
router.post('/:id/reopen', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can reopen this auction' });
    }

    if (auction.status === 'sold') {
      return res.status(400).json({ error: 'A sold auction cannot be reopened' });
    }

    // Only auctions that ran out of time. Auctions closed by an admin stay closed.
    if (auction.status !== 'active') {
      return res.status(400).json({ error: 'This auction cannot be reopened' });
    }

    if (new Date() <= new Date(auction.endsAt)) {
      return res.status(400).json({ error: 'This auction is still running' });
    }

    if ((auction.reopenCount || 0) >= MAX_REOPENS) {
      return res.status(400).json({ error: `You can only reopen an auction ${MAX_REOPENS} times` });
    }

    auction.endsAt = new Date(Date.now() + AUCTION_LENGTH_MS);
    auction.reopenCount = (auction.reopenCount || 0) + 1;
    auction.isLive = false;
    auction.liveStartedAt = null;

    await auction.save();

    const populatedAuction = await loadAuction(auction._id);
    res.json(populatedAuction);
  } catch (err) {
    console.error('POST /auctions/:id/reopen error:', err);
    res.status(500).json({ error: err.message });
  }
});

// RATE THE SELLER - Only the winning buyer, once per sale, after the sale is paid
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5' });
    }

    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (comment.length > 500) {
      return res.status(400).json({ error: 'Review cannot be longer than 500 characters' });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (
      auction.status !== 'sold' ||
      !auction.winnerId ||
      auction.winnerId.toString() !== req.user.userId
    ) {
      return res.status(403).json({ error: 'Only the winning buyer can review the seller' });
    }

    try {
      await Review.create({
        auctionId: auction._id,
        sellerId: auction.sellerId,
        reviewerId: req.user.userId,
        rating,
        comment
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: 'You have already reviewed this sale' });
      }
      throw e;
    }

    res.status(201).json({ message: 'Thanks for your review' });
  } catch (err) {
    console.error('POST /auctions/:id/review error:', err);
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
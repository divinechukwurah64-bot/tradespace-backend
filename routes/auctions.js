const express = require('express');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');

const router = express.Router();

// GET ALL AUCTIONS
router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('sellerId', 'name email phone')
      .populate('bids.bidderId', 'name email')
      .sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE AUCTION
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('sellerId', 'name email phone')
      .populate('bids.bidderId', 'name email')
      .populate('winnerId', 'name email');

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json(auction);
  } catch (err) {
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
      sellerId: req.user.id,
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

    const populatedAuction = await auction
      .populate('sellerId', 'name email phone');

    res.status(201).json(populatedAuction);
  } catch (err) {
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

    if (auction.sellerId.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot bid on your own auction' });
    }

    auction.currentBid = amount;
    auction.bids.push({
      bidderId: req.user.id,
      amount,
      timestamp: new Date(),
    });

    await auction.save();

    const populatedAuction = await auction
      .populate('sellerId', 'name email phone')
      .populate('bids.bidderId', 'name email');

    res.json(populatedAuction);
  } catch (err) {
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

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own auctions' });
    }

    if (auction.bids && auction.bids.length > 0) {
      return res.status(400).json({ error: 'Cannot delete auction with active bids' });
    }

    await Auction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Auction deleted successfully' });
  } catch (err) {
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

    if (auction.sellerId.toString() !== req.user.id) {
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

    const populatedAuction = await auction
      .populate('sellerId', 'name email phone')
      .populate('bids.bidderId', 'name email');

    res.json(populatedAuction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
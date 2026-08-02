const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, startingBid, buyItNowPrice, images, condition, shippingCost, endsAt } = req.body;
    
    if (!title || !description || !category || !startingBid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const auction = new Auction({
      sellerId: req.user.userId,
      title,
      description,
      category,
      startingBid,
      currentBid: startingBid,
      buyItNowPrice: buyItNowPrice || null,
      images: images || [],
      condition: condition || 'Good',
      shippingCost: shippingCost || 0,
      endsAt
    });
    
    await auction.save();
    
    res.status(201).json({
      message: 'Auction created successfully',
      auction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find({ status: 'active' })
      .populate('sellerId', 'fullName sellerRating')
      .sort({ createdAt: -1 });
    
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('sellerId', 'fullName sellerRating email phone')
      .populate('bids.bidderId', 'fullName');
    
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    res.json(auction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/bid', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const auctionId = req.params.id;
    
    if (!amount) {
      return res.status(400).json({ error: 'Bid amount required' });
    }
    
    const auction = await Auction.findById(auctionId);
    
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.status !== 'active') {
      return res.status(400).json({ error: 'Auction is not active' });
    }
    
    if (new Date() > auction.endsAt) {
      return res.status(400).json({ error: 'Auction has ended' });
    }
    
    if (amount <= auction.currentBid) {
      return res.status(400).json({ error: `Bid must be higher than ${auction.currentBid}` });
    }
    
    if (auction.sellerId.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Seller cannot bid on their own auction' });
    }
    
    auction.bids.push({
      bidderId: req.user.userId,
      amount
    });
    
    auction.currentBid = amount;
    await auction.save();
    
    const io = req.app.get('io');
    io.to(`auction:${auctionId}`).emit('auction:bid', {
      auctionId,
      bidderId: req.user.userId,
      amount,
      timestamp: new Date()
    });
    
    res.json({
      message: 'Bid placed successfully',
      auction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/user/my-auctions', authMiddleware, async (req, res) => {
  try {
    const auctions = await Auction.find({ sellerId: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only seller can delete this auction' });
    }

    await Auction.findByIdAndDelete(auctionId);

    res.json({ message: 'Auction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Auction = require('../models/Auction');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { auctionId, gigId, sellerId, amount } = req.body;
    
    if (!sellerId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const transaction = new Transaction({
      auctionId: auctionId || null,
      gigId: gigId || null,
      buyerId: req.user.userId,
      sellerId,
      amount,
      platformCommissionPercent: process.env.PLATFORM_COMMISSION_PERCENT || 10
    });
    
    await transaction.save();
    
    res.status(201).json({
      message: 'Transaction created',
      transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('buyerId', 'fullName email')
      .populate('sellerId', 'fullName email');
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/inspect', authMiddleware, async (req, res) => {
  try {
    const { status, photos, notes } = req.body;
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid inspection status' });
    }
    
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.buyerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only buyer can inspect' });
    }
    
    transaction.inspectionStatus = status;
    transaction.inspectionPhotos = photos || [];
    transaction.inspectionNotes = notes || '';
    
    if (status === 'rejected') {
      transaction.disputeStatus = 'filed';
      transaction.returnInitiatedAt = new Date();
      
      const seller = await User.findById(transaction.sellerId);
      seller.stars = Math.max(0, seller.stars - 1);
      await seller.save();
    }
    
    await transaction.save();
    
    res.json({
      message: `Inspection ${status}`,
      transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/confirm-return', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only seller can confirm return' });
    }
    
    if (transaction.inspectionStatus !== 'rejected') {
      return res.status(400).json({ error: 'Item was not rejected' });
    }
    
    transaction.returnConfirmedAt = new Date();
    transaction.paymentStatus = 'refunded';
    transaction.disputeStatus = 'resolved';
    
    await transaction.save();
    
    res.json({
      message: 'Return confirmed, refund processed',
      transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/release-payment', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.inspectionStatus !== 'approved') {
      return res.status(400).json({ error: 'Item not approved for payment release' });
    }
    
    transaction.paymentStatus = 'released';
    transaction.releasedAt = new Date();
    
    await transaction.save();
    
    res.json({
      message: 'Payment released to seller',
      transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
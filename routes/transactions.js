const express = require('express');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// MY TRANSACTIONS - read only. Payments are created and settled by routes/payments.js.
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const items = await Transaction.find({
      $or: [{ buyerId: req.user.userId }, { sellerId: req.user.userId }]
    })
      .select('auctionId amount paymentStatus payoutStatus disputeStatus buyerId sellerId createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(items);
  } catch (err) {
    console.error('GET /transactions/mine error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
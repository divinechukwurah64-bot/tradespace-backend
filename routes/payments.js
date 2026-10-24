const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');
const paystack = require('../utils/paystack');
const { settleTransaction } = require('../utils/payments');

const router = express.Router();

const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

const describe = (err) =>
  err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

// PAYSTACK WEBHOOK - Paystack tells us a payment succeeded, even if the buyer closed the tab
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'];

    if (!secret || !signature || !req.rawBody) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    if (event && event.event === 'charge.success' && event.data && event.data.reference) {
      await settleTransaction(event.data.reference);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('POST /payments/webhook error:', describe(err));
    res.status(500).json({ error: 'Webhook failed' });
  }
});

// START A PAYMENT - only the winning bidder. The price and the seller come from the auction.
router.post('/auctions/:id/initialize', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'This auction is not waiting for payment' });
    }

    if (!auction.winnerId || auction.winnerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the winning bidder can pay' });
    }

    if (!auction.paymentDueAt || new Date() > new Date(auction.paymentDueAt)) {
      return res.status(400).json({ error: 'The payment deadline has passed' });
    }

    const [buyer, seller] = await Promise.all([
      User.findById(req.user.userId).select('email'),
      User.findById(auction.sellerId).select('+paystackRecipientCode')
    ]);

    if (!buyer) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!seller || !seller.paystackRecipientCode) {
      return res.status(400).json({ error: 'The seller cannot receive payments yet. Please try again later.' });
    }

    const amount = Number(auction.winningBid);
    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const reference = `TS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const tx = await Transaction.create({
      auctionId: auction._id,
      buyerId: buyer._id,
      sellerId: auction.sellerId,
      amount,
      platformCommissionPercent: Number(process.env.PLATFORM_COMMISSION_PERCENT) || 10,
      paymentStatus: 'pending',
      paystackReference: reference
    });

    let init;
    try {
      init = await paystack.initializeTransaction({
        email: buyer.email,
        amountKobo: Math.round(amount * 100),
        reference,
        callbackUrl: `${frontendBaseUrl()}/auctions/${auction._id}`,
        metadata: { auctionId: String(auction._id), transactionId: String(tx._id) }
      });
    } catch (err) {
      tx.paymentStatus = 'failed';
      await tx.save();
      throw err;
    }

    res.json({ authorizationUrl: init.authorization_url, reference });
  } catch (err) {
    console.error('POST /payments/auctions/:id/initialize error:', describe(err));
    res.status(err.response || err.code === 'NOT_CONFIGURED' ? 503 : 500).json({
      error: 'Payments are unavailable right now'
    });
  }
});

// CONFIRM A PAYMENT - the buyer comes back from Paystack and we check what really happened
router.post('/verify', auth, async (req, res) => {
  try {
    const reference = typeof req.body.reference === 'string' ? req.body.reference : '';
    if (!reference) {
      return res.status(400).json({ error: 'Missing payment reference' });
    }

    const tx = await Transaction.findOne({ paystackReference: reference, buyerId: req.user.userId });
    if (!tx) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const settled = await settleTransaction(reference);
    const auction = await Auction.findById(tx.auctionId).select('status');

    res.json({
      paymentStatus: settled ? settled.paymentStatus : tx.paymentStatus,
      auctionStatus: auction ? auction.status : null
    });
  } catch (err) {
    console.error('POST /payments/verify error:', describe(err));
    res.status(503).json({ error: 'Could not confirm the payment right now' });
  }
});

module.exports = router;
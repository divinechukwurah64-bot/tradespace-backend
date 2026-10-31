const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');
const paystack = require('../utils/paystack');
const notify = require('../utils/notify');
const {
  settleTransaction,
  attemptPayout,
  handleTransferResult,
  notifyAdmins,
  AUTO_RELEASE_MS
} = require('../utils/payments');
const { getFrontendBase } = require('../utils/frontendUrl');

const router = express.Router();

const DISPUTE_REASONS = [
  'Item not received',
  'Item not as described',
  'Item damaged',
  'Other'
];

const SELLER_COMPLAINT_REASONS = [
  'Buyer is not responding',
  'Buyer refused the item',
  'Buyer is making a false claim',
  'Other'
];

const PAID_STATUSES = ['held', 'captured', 'released', 'refunded'];

const money = (n) => `₦${Number(n).toLocaleString()}`;

const describe = (err) =>
  err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;

const joinNotes = (existing, addition) =>
  `${existing ? existing + ' | ' : ''}${addition}`.slice(0, 1000);

// The last moment a normal complaint can be filed: 7 days after the payment arrived
const windowEndsAt = (tx) =>
  tx.capturedAt ? new Date(new Date(tx.capturedAt).getTime() + AUTO_RELEASE_MS) : null;

// What the bought and sold lists show for one sale
const shapeSale = (tx, role) => {
  const auction = tx.auctionId;
  const other = role === 'buyer' ? tx.sellerId : tx.buyerId;

  return {
    transactionId: tx._id,
    auctionId: auction._id,
    title: auction.title,
    image: auction.images && auction.images[0] ? auction.images[0] : null,
    amount: tx.amount,
    sellerPayout: role === 'seller' ? tx.sellerPayout : null,
    otherName: other && other.fullName ? other.fullName : null,
    paymentStatus: tx.paymentStatus,
    payoutStatus: tx.payoutStatus,
    disputeStatus: tx.disputeStatus,
    buyerReported: !!tx.disputeOpenedAt,
    sellerComplained: !!tx.sellerComplaintAt,
    paidAt: tx.capturedAt,
    windowEndsAt: windowEndsAt(tx)
  };
};

// The payment for an auction that the buyer has paid. Only the buyer or the seller may see it.
const findPaidTransaction = (auctionId) =>
  Transaction.findOne({
    auctionId,
    paymentStatus: { $in: ['held', 'released', 'refunded', 'captured'] }
  }).sort({ capturedAt: -1, createdAt: -1 });

// PAYSTACK WEBHOOK - payments and payouts both report here
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
    const data = event && event.data;

    if (event && data && data.reference) {
      if (event.event === 'charge.success') {
        await settleTransaction(data.reference);
      } else if (event.event === 'transfer.success') {
        await handleTransferResult(data.reference, 'success');
      } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
        await handleTransferResult(
          data.reference,
          'failed',
          typeof data.failures === 'string' ? data.failures : event.event
        );
      }
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
        callbackUrl: `${getFrontendBase(req)}/auctions/${auction._id}`,
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

// MY PURCHASES - paid in the last 7 days, plus any with a complaint still open
router.get('/bought', auth, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - AUTO_RELEASE_MS);

    const items = await Transaction.find({
      buyerId: req.user.userId,
      auctionId: { $ne: null },
      paymentStatus: { $in: PAID_STATUSES },
      $or: [{ capturedAt: { $gte: cutoff } }, { disputeStatus: 'filed' }]
    })
      .populate('auctionId', 'title images')
      .populate('sellerId', 'fullName')
      .sort({ capturedAt: -1 })
      .limit(50);

    res.json(items.filter((tx) => tx.auctionId).map((tx) => shapeSale(tx, 'buyer')));
  } catch (err) {
    console.error('GET /payments/bought error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MY SALES THIS WEEK - same window, from the seller's side
router.get('/sold', auth, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - AUTO_RELEASE_MS);

    const items = await Transaction.find({
      sellerId: req.user.userId,
      auctionId: { $ne: null },
      paymentStatus: { $in: PAID_STATUSES },
      $or: [{ capturedAt: { $gte: cutoff } }, { disputeStatus: 'filed' }]
    })
      .populate('auctionId', 'title images')
      .populate('buyerId', 'fullName')
      .sort({ capturedAt: -1 })
      .limit(50);

    res.json(items.filter((tx) => tx.auctionId).map((tx) => shapeSale(tx, 'seller')));
  } catch (err) {
    console.error('GET /payments/sold error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WHERE IS THE MONEY - what the buyer or the seller sees after a payment
router.get('/auctions/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const tx = await findPaidTransaction(id);
    if (!tx) {
      return res.json({ payment: null });
    }

    const isBuyer = tx.buyerId.toString() === req.user.userId;
    const isSeller = tx.sellerId.toString() === req.user.userId;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Not allowed to view this payment' });
    }

    res.json({
      payment: {
        role: isBuyer ? 'buyer' : 'seller',
        status: tx.paymentStatus,
        payoutStatus: tx.payoutStatus,
        amount: tx.amount,
        sellerPayout: isSeller ? tx.sellerPayout : null,
        autoReleaseAt: tx.autoReleaseAt,
        windowEndsAt: windowEndsAt(tx),
        disputeStatus: tx.disputeStatus,
        buyerReported: !!tx.disputeOpenedAt,
        buyerReportReason: tx.disputeOpenedAt ? tx.disputeReason : '',
        sellerComplained: !!tx.sellerComplaintAt,
        sellerComplaintReason: tx.sellerComplaintAt ? tx.sellerComplaintReason : '',
        disputeReason: isBuyer ? tx.disputeReason : null
      }
    });
  } catch (err) {
    console.error('GET /payments/auctions/:id/status error:', describe(err));
    res.status(500).json({ error: err.message });
  }
});

// I RECEIVED THE ITEM - the buyer releases the payment to the seller.
// If only the seller has complained, this also closes that complaint.
router.post('/auctions/:id/confirm-received', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const tx = await findPaidTransaction(id);
    if (!tx || tx.buyerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (tx.paymentStatus !== 'held') {
      return res.status(400).json({ error: 'This payment cannot be released' });
    }
    if (tx.disputeStatus === 'filed' && tx.disputeOpenedAt) {
      return res.status(400).json({ error: 'A problem was reported, so our team will decide this' });
    }
    if (tx.payoutStatus !== 'none') {
      return res.status(400).json({ error: 'The seller is already being paid' });
    }

    const closingSellerComplaint = tx.disputeStatus === 'filed';
    const now = new Date();

    const update = {
      inspectionStatus: 'approved',
      payoutStatus: 'queued',
      payoutNextAttemptAt: now,
      autoReleaseAt: null
    };
    if (closingSellerComplaint) {
      update.disputeStatus = 'resolved';
      update.disputeResolvedAt = now;
      update.disputeNotes = joinNotes(
        tx.disputeNotes,
        'The buyer confirmed receipt, so the seller complaint was closed'
      );
    }

    // One step, so a report or an auto release cannot slip in between
    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: tx._id,
        buyerId: req.user.userId,
        paymentStatus: 'held',
        payoutStatus: 'none',
        disputeStatus: tx.disputeStatus,
        disputeOpenedAt: null
      },
      { $set: update },
      { new: true }
    );

    if (!claimed) {
      return res.status(409).json({ error: 'This payment just changed. Please refresh and try again.' });
    }

    await notify(claimed.sellerId, {
      type: 'payment',
      title: 'The buyer confirmed receipt',
      message: `${money(claimed.sellerPayout)} is being sent to your bank account.`,
      link: `/auctions/${claimed.auctionId}`
    });

    await attemptPayout(claimed._id);

    const fresh = await Transaction.findById(claimed._id).select('paymentStatus payoutStatus');
    res.json({ paymentStatus: fresh.paymentStatus, payoutStatus: fresh.payoutStatus });
  } catch (err) {
    console.error('POST /payments/auctions/:id/confirm-received error:', describe(err));
    res.status(500).json({ error: err.message });
  }
});

// REPORT A PROBLEM - the buyer freezes the payment until our team decides
router.post('/auctions/:id/dispute', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!DISPUTE_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Choose a reason' });
    }
    if (note.length > 500) {
      return res.status(400).json({ error: 'Your note cannot be longer than 500 characters' });
    }

    const tx = await findPaidTransaction(id);
    if (!tx || tx.buyerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const filed = await Transaction.findOneAndUpdate(
      {
        _id: tx._id,
        buyerId: req.user.userId,
        paymentStatus: 'held',
        payoutStatus: 'none',
        disputeOpenedAt: null,
        disputeStatus: { $ne: 'resolved' }
      },
      {
        $set: {
          disputeStatus: 'filed',
          disputeReason: reason,
          disputeNotes: note,
          disputeOpenedAt: new Date(),
          autoReleaseAt: null
        }
      },
      { new: true }
    );

    if (!filed) {
      if (tx.disputeOpenedAt) {
        return res.status(400).json({ error: 'You have already reported a problem' });
      }
      if (tx.paymentStatus !== 'held') {
        return res.status(400).json({ error: 'A problem can only be reported on a payment that is still held' });
      }
      return res.status(400).json({ error: 'The seller has already been paid or is being paid' });
    }

    const auction = await Auction.findById(filed.auctionId).select('title');
    const title = auction ? auction.title : 'an item';

    await notify(filed.sellerId, {
      type: 'payment',
      title: 'The buyer reported a problem',
      message: `"${title}": ${reason}. Our team is reviewing it and the payment is on hold.`,
      link: `/auctions/${filed.auctionId}`
    });
    await notifyAdmins({
      type: 'payment',
      title: 'New payment dispute',
      message: `"${title}" (${money(filed.amount)}): ${reason}.`,
      link: '/admin'
    });

    res.json({ disputeStatus: 'filed' });
  } catch (err) {
    console.error('POST /payments/auctions/:id/dispute error:', describe(err));
    res.status(500).json({ error: err.message });
  }
});

// REPORT A PROBLEM WITH A SALE - the seller freezes the payment until our team decides.
// Allowed for 7 days after the payment, or while a problem is already open on this sale.
router.post('/auctions/:id/complaint', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!SELLER_COMPLAINT_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Choose a reason' });
    }
    if (note.length > 500) {
      return res.status(400).json({ error: 'Your note cannot be longer than 500 characters' });
    }

    const tx = await findPaidTransaction(id);
    if (!tx || tx.sellerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - AUTO_RELEASE_MS);

    const filed = await Transaction.findOneAndUpdate(
      {
        _id: tx._id,
        sellerId: req.user.userId,
        paymentStatus: 'held',
        payoutStatus: 'none',
        sellerComplaintAt: null,
        disputeStatus: { $ne: 'resolved' },
        $or: [{ disputeStatus: 'filed' }, { capturedAt: { $gte: cutoff } }]
      },
      {
        $set: {
          disputeStatus: 'filed',
          sellerComplaintReason: reason,
          sellerComplaintNote: note,
          sellerComplaintAt: now,
          autoReleaseAt: null
        }
      },
      { new: true }
    );

    if (!filed) {
      if (tx.sellerComplaintAt) {
        return res.status(400).json({ error: 'You have already reported a problem with this sale' });
      }
      if (tx.paymentStatus !== 'held' || tx.payoutStatus !== 'none') {
        return res.status(400).json({
          error: 'This payment has already been released or refunded, so a problem can no longer be reported'
        });
      }
      return res.status(400).json({ error: 'The 7 day period for reporting a problem with this sale has ended' });
    }

    const auction = await Auction.findById(filed.auctionId).select('title');
    const title = auction ? auction.title : 'an item';
    const buyerAlsoReported = !!filed.disputeOpenedAt;

    await notify(filed.buyerId, {
      type: 'payment',
      title: 'The seller reported a problem with this sale',
      message:
        `"${title}": ${reason}. Our team is reviewing it and the payment is on hold.` +
        (buyerAlsoReported ? '' : ' If you have the item, you can confirm it on the auction page to close this.'),
      link: `/auctions/${filed.auctionId}`
    });
    await notifyAdmins({
      type: 'payment',
      title: 'New seller complaint',
      message: `"${title}" (${money(filed.amount)}): ${reason}.`,
      link: '/admin'
    });

    res.json({ disputeStatus: 'filed' });
  } catch (err) {
    console.error('POST /payments/auctions/:id/complaint error:', describe(err));
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
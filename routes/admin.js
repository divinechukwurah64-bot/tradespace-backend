const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const paystack = require('../utils/paystack');
const notify = require('../utils/notify');
const { attemptPayout } = require('../utils/payments');

const router = express.Router();

const LAGOS = 'Africa/Lagos';

const money = (n) => `₦${Number(n).toLocaleString()}`;

const joinNotes = (existing, addition) =>
  `${existing ? existing + ' | ' : ''}${addition}`.slice(0, 1000);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Only plain lowercase words count as a status filter. Objects and arrays are ignored.
const cleanStatus = (value) =>
  typeof value === 'string' && /^[a-z_]{1,30}$/.test(value) ? value : null;

const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Every route in this file requires a logged-in admin
router.use(auth, admin);

// ARE YOU AN ADMIN? Only admins get a reply. Everyone else is refused above.
router.get('/me', (req, res) => {
  res.json({ role: 'admin' });
});

// DASHBOARD STATS
router.get('/stats', async (req, res) => {
  try {
    const [users, bannedUsers, activeAuctions, totalAuctions, totalGigs, openDisputes, failedPayouts] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isBanned: true }),
        Auction.countDocuments({ status: 'active' }),
        Auction.countDocuments(),
        Gig.countDocuments(),
        Transaction.countDocuments({ disputeStatus: 'filed' }),
        Transaction.countDocuments({ payoutStatus: 'failed' })
      ]);
    res.json({
      users,
      bannedUsers,
      activeAuctions,
      totalAuctions,
      totalGigs,
      openDisputes,
      failedPayouts
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MONEY OVERVIEW - totals, sales per day for 14 days, and sales by category
router.get('/overview', async (req, res) => {
  try {
    const paid = { paymentStatus: { $in: ['held', 'released'] } };
    const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    const [totals, dailyRows, categoryRows, held, readyToPay] = await Promise.all([
      Transaction.aggregate([
        { $match: paid },
        {
          $group: {
            _id: null,
            sales: { $sum: '$amount' },
            commission: { $sum: '$platformCommission' },
            orders: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: paid },
        { $addFields: { paidOn: { $ifNull: ['$capturedAt', '$createdAt'] } } },
        { $match: { paidOn: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidOn', timezone: LAGOS } },
            total: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        { $match: paid },
        { $lookup: { from: 'auctions', localField: 'auctionId', foreignField: '_id', as: 'auction' } },
        { $lookup: { from: 'gigs', localField: 'gigId', foreignField: '_id', as: 'gig' } },
        {
          $addFields: {
            category: {
              $ifNull: [{ $arrayElemAt: ['$auction.category', 0] }, { $arrayElemAt: ['$gig.category', 0] }]
            }
          }
        },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Transaction.aggregate([
        { $match: { paymentStatus: 'held' } },
        { $group: { _id: null, owed: { $sum: '$sellerPayout' }, count: { $sum: 1 } } }
      ]),
      Transaction.countDocuments({
        paymentStatus: 'held',
        payoutStatus: { $in: ['none', 'queued', 'failed'] },
        disputeStatus: { $ne: 'filed' }
      })
    ]);

    const byDay = new Map(dailyRows.map((row) => [row._id, row]));
    const daily = [];
    for (let i = 13; i >= 0; i -= 1) {
      const key = dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
      const row = byDay.get(key);
      daily.push({ date: key, total: row ? round2(row.total) : 0, orders: row ? row.orders : 0 });
    }

    const merged = new Map();
    for (const row of categoryRows) {
      const name = row._id && String(row._id).trim() ? String(row._id).trim() : 'Other';
      const existing = merged.get(name) || { category: name, total: 0, count: 0 };
      existing.total += Number(row.total || 0);
      existing.count += row.count;
      merged.set(name, existing);
    }
    const categories = [...merged.values()]
      .map((c) => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total);

    res.json({
      totalSales: totals[0] ? round2(totals[0].sales) : 0,
      commissionEarned: totals[0] ? round2(totals[0].commission) : 0,
      paidOrders: totals[0] ? totals[0].orders : 0,
      owedToSellers: held[0] ? round2(held[0].owed) : 0,
      heldCount: held[0] ? held[0].count : 0,
      readyToPay,
      daily,
      categories
    });
  } catch (err) {
    console.error('GET /admin/overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST USERS (optional ?search=)
router.get('/users', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const pattern = search ? escapeRegex(search) : '';
    const filter = pattern
      ? {
          $or: [
            { fullName: { $regex: pattern, $options: 'i' } },
            { email: { $regex: pattern, $options: 'i' } }
          ]
        }
      : {};
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(users);
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// BAN / UNBAN USER
router.patch('/users/:id/ban', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user' });
    }
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
    console.error('PATCH /admin/users/:id/ban error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UNBLOCK BIDDING - clears the unpaid-win strikes
router.patch('/users/:id/unblock-bidding', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user' });
    }
    const target = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { biddingBlocked: false, paymentDefaults: 0 } },
      { new: true }
    ).select('biddingBlocked paymentDefaults');
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    await notify(target._id, {
      type: 'info',
      title: 'You can bid again',
      message: 'Your bidding block was lifted and your strikes were cleared.',
      link: '/auctions'
    });
    res.json({ _id: target._id, biddingBlocked: target.biddingBlocked, paymentDefaults: target.paymentDefaults });
  } catch (err) {
    console.error('PATCH /admin/users/:id/unblock-bidding error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST ALL AUCTIONS (optional ?status=active|ended|sold)
router.get('/auctions', async (req, res) => {
  try {
    const status = cleanStatus(req.query.status);
    const filter = status ? { status } : {};
    const auctions = await Auction.find(filter)
      .populate('sellerId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(auctions);
  } catch (err) {
    console.error('GET /admin/auctions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// FORCE END AN AUCTION - only one that is still running
router.patch('/auctions/:id/end', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    if (auction.status !== 'active') {
      return res.status(409).json({
        error: 'Only a running auction can be ended. A sale in progress is handled from the Transactions tab.'
      });
    }
    auction.status = 'ended';
    auction.endsAt = new Date();
    await auction.save();
    res.json({ _id: auction._id, status: auction.status });
  } catch (err) {
    console.error('PATCH /admin/auctions/:id/end error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE AN AUCTION - not while a sale or a held payment depends on it
router.delete('/auctions/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }
    const auction = await Auction.findById(req.params.id).select('status');
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    if (['sold', 'awaiting_payment'].includes(auction.status)) {
      return res.status(409).json({
        error: 'This auction has a sale in progress. Handle it from the Transactions tab first.'
      });
    }
    const moneyHeld = await Transaction.exists({
      auctionId: auction._id,
      paymentStatus: { $in: ['held', 'captured'] }
    });
    if (moneyHeld) {
      return res.status(409).json({
        error: 'A payment for this auction is still held. Refund or pay it out first.'
      });
    }
    await Auction.deleteOne({ _id: auction._id });
    res.json({ message: 'Auction removed' });
  } catch (err) {
    console.error('DELETE /admin/auctions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST ALL GIGS (optional ?status=active|paused|completed)
router.get('/gigs', async (req, res) => {
  try {
    const status = cleanStatus(req.query.status);
    const filter = status ? { status } : {};
    const gigs = await Gig.find(filter)
      .populate('sellerId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(gigs);
  } catch (err) {
    console.error('GET /admin/gigs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PAUSE / REACTIVATE A GIG
router.patch('/gigs/:id/status', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid gig' });
    }
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    if (gig.status === 'completed') {
      return res.status(400).json({ error: 'A completed gig cannot be paused or reactivated' });
    }
    gig.status = gig.status === 'active' ? 'paused' : 'active';
    await gig.save();
    res.json({ _id: gig._id, status: gig.status });
  } catch (err) {
    console.error('PATCH /admin/gigs/:id/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE A GIG
router.delete('/gigs/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid gig' });
    }
    const gig = await Gig.findByIdAndDelete(req.params.id);
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    res.json({ message: 'Gig removed' });
  } catch (err) {
    console.error('DELETE /admin/gigs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST ALL TRANSACTIONS - the seller's bank name and name on the account are included so you can pay by hand
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('buyerId', 'fullName email')
      .populate('sellerId', 'fullName email phone bankName bankAccountName bankAccountLast4')
      .populate('auctionId', 'title')
      .populate('gigId', 'title')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(transactions);
  } catch (err) {
    console.error('GET /admin/transactions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REFUND THE BUYER - for a payment that is held and has not been paid out
router.post('/transactions/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';

    // Claim the payment first, so a payout cannot start while the refund is going through
    const before = await Transaction.findOneAndUpdate(
      {
        _id: id,
        paymentStatus: { $in: ['held', 'captured'] },
        payoutStatus: { $in: ['none', 'queued', 'failed'] }
      },
      {
        $set: {
          paymentStatus: 'captured',
          payoutStatus: 'none',
          payoutNextAttemptAt: null,
          autoReleaseAt: null
        }
      }
    );

    if (!before) {
      return res.status(409).json({
        error: 'This payment cannot be refunded. It may already be refunded, paid out, or being paid out.'
      });
    }

    try {
      await paystack.refundTransaction(before.paystackReference);
    } catch (err) {
      // Put the payment back exactly as it was
      await Transaction.updateOne(
        { _id: id },
        {
          $set: {
            paymentStatus: before.paymentStatus,
            payoutStatus: before.payoutStatus,
            payoutNextAttemptAt: before.payoutNextAttemptAt,
            autoReleaseAt: before.autoReleaseAt
          }
        }
      );
      const detail =
        err.response && err.response.data && err.response.data.message
          ? err.response.data.message
          : err.message;
      console.error('Admin refund failed:', detail);
      return res.status(err.response ? 400 : 503).json({
        error: `Paystack could not process the refund: ${detail}`
      });
    }

    const tx = await Transaction.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: 'refunded',
          inspectionStatus: 'rejected',
          disputeStatus: 'resolved',
          disputeResolvedAt: new Date(),
          disputeNotes: joinNotes(before.disputeNotes, `Admin refunded the buyer${note ? `: ${note}` : ''}`)
        }
      },
      { new: true }
    );

    // The sale did not go through, so the auction goes back to the seller, expired and reopenable
    const auction = await Auction.findById(tx.auctionId);
    if (auction && auction.status === 'sold' && String(auction.winnerId) === String(tx.buyerId)) {
      auction.status = 'active';
      auction.winnerId = null;
      auction.winningBid = null;
      auction.soldAt = null;
      auction.paidAt = null;
      auction.paymentDueAt = null;
      auction.paymentReminderSent = false;
      await auction.save();
    }

    const title = auction ? auction.title : 'the item';

    await notify(tx.buyerId, {
      type: 'payment',
      title: 'Your payment was refunded',
      message: `${money(tx.amount)} for "${title}" is being sent back to you.${note ? ` Note from our team: ${note}` : ''}`,
      link: `/auctions/${tx.auctionId}`
    });
    await notify(tx.sellerId, {
      type: 'payment',
      title: 'Payment refunded to the buyer',
      message: `${money(tx.amount)} for "${title}" was refunded after review. The auction is back with you and can be reopened.${note ? ` Note from our team: ${note}` : ''}`,
      link: `/auctions/${tx.auctionId}`
    });

    res.json({ paymentStatus: tx.paymentStatus });
  } catch (err) {
    console.error('POST /admin/transactions/:id/refund error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PAY THE SELLER - the dispute is decided for the seller, or a failed payout is retried
router.post('/transactions/:id/release', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';

    const current = await Transaction.findById(id);
    if (!current) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const wasDisputed = current.disputeStatus === 'filed';

    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: id,
        paymentStatus: 'held',
        payoutStatus: { $in: ['none', 'failed'] }
      },
      {
        $set: {
          payoutStatus: 'queued',
          payoutNextAttemptAt: new Date(),
          payoutError: '',
          inspectionStatus: 'approved',
          autoReleaseAt: null,
          disputeStatus: wasDisputed ? 'resolved' : current.disputeStatus,
          disputeResolvedAt: wasDisputed ? new Date() : current.disputeResolvedAt,
          disputeNotes: wasDisputed
            ? joinNotes(current.disputeNotes, `Admin paid the seller${note ? `: ${note}` : ''}`)
            : current.disputeNotes
        }
      },
      { new: true }
    );

    if (!claimed) {
      return res.status(409).json({
        error: 'This payment cannot be released. It may already be paid out, being paid out, or refunded.'
      });
    }

    const auction = await Auction.findById(claimed.auctionId).select('title');
    const title = auction ? auction.title : 'the item';

    await notify(claimed.sellerId, {
      type: 'payment',
      title: 'Your payout is on its way',
      message: `${money(claimed.sellerPayout)} for "${title}" is being sent to your bank.${note ? ` Note from our team: ${note}` : ''}`,
      link: `/auctions/${claimed.auctionId}`
    });
    if (wasDisputed) {
      await notify(claimed.buyerId, {
        type: 'payment',
        title: 'Your reported problem was reviewed',
        message: `After review, the payment for "${title}" was released to the seller.${note ? ` Note from our team: ${note}` : ''}`,
        link: `/auctions/${claimed.auctionId}`
      });
    }

    await attemptPayout(claimed._id);

    const fresh = await Transaction.findById(id).select('paymentStatus payoutStatus payoutError');
    res.json({
      paymentStatus: fresh.paymentStatus,
      payoutStatus: fresh.payoutStatus,
      payoutError: fresh.payoutError
    });
  } catch (err) {
    console.error('POST /admin/transactions/:id/release error:', err);
    res.status(500).json({ error: err.message });
  }
});

// RECORD A MANUAL PAYOUT - you sent the seller their money yourself, so mark the sale as paid.
// This does not move any money. It only records that you did, and tells the seller.
router.post('/transactions/:id/manual-payout', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    const reference = typeof req.body.reference === 'string' ? req.body.reference.trim() : '';
    if (reference.length < 3 || reference.length > 100) {
      return res.status(400).json({ error: 'Enter the reference or description of your bank transfer (3 to 100 characters)' });
    }
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';

    const current = await Transaction.findById(id);
    if (!current) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (current.paymentStatus !== 'held') {
      return res.status(409).json({ error: 'Only a payment that is still held can be marked as paid' });
    }
    if (['processing', 'paid'].includes(current.payoutStatus)) {
      return res.status(409).json({
        error: 'A payout is already being sent or has been sent for this payment. Wait for it to finish before doing anything.'
      });
    }

    // If an automatic payout was ever started, make sure it did not actually go through
    if (current.payoutReference) {
      let previous = null;
      try {
        previous = await paystack.verifyTransfer(current.payoutReference);
      } catch (err) {
        if (!(err.response && err.response.status === 404)) {
          return res.status(503).json({
            error: 'Could not check the earlier payout attempt with Paystack. Try again in a moment.'
          });
        }
      }
      if (previous && !['failed', 'reversed'].includes(previous.status)) {
        return res.status(409).json({
          error: `Paystack shows an earlier payout attempt for this sale (status: ${previous.status}). Do not send the money again.`
        });
      }
    }

    const wasDisputed = current.disputeStatus === 'filed';
    const now = new Date();

    const claimed = await Transaction.findOneAndUpdate(
      {
        _id: id,
        paymentStatus: 'held',
        payoutStatus: { $in: ['none', 'queued', 'failed'] }
      },
      {
        $set: {
          paymentStatus: 'released',
          payoutStatus: 'paid',
          releasedAt: now,
          payoutAt: now,
          payoutError: '',
          payoutNextAttemptAt: null,
          inspectionStatus: 'approved',
          autoReleaseAt: null,
          disputeStatus: wasDisputed ? 'resolved' : current.disputeStatus,
          disputeResolvedAt: wasDisputed ? now : current.disputeResolvedAt,
          disputeNotes: joinNotes(
            current.disputeNotes,
            `Admin recorded a manual payout (ref: ${reference})${note ? `: ${note}` : ''}`
          )
        }
      },
      { new: true }
    );

    if (!claimed) {
      return res.status(409).json({
        error: 'This payment just changed. Refresh the page and check its status before doing anything.'
      });
    }

    const auction = await Auction.findById(claimed.auctionId).select('title');
    const title = auction ? auction.title : 'the item';

    await notify(claimed.sellerId, {
      type: 'payment',
      title: 'You have been paid',
      message: `${money(claimed.sellerPayout)} for "${title}" was sent to your bank account. Reference: ${reference}.${note ? ` Note from our team: ${note}` : ''}`,
      link: `/auctions/${claimed.auctionId}`
    });
    if (wasDisputed) {
      await notify(claimed.buyerId, {
        type: 'payment',
        title: 'Your reported problem was reviewed',
        message: `After review, the payment for "${title}" was released to the seller.${note ? ` Note from our team: ${note}` : ''}`,
        link: `/auctions/${claimed.auctionId}`
      });
    }

    res.json({ paymentStatus: claimed.paymentStatus, payoutStatus: claimed.payoutStatus });
  } catch (err) {
    console.error('POST /admin/transactions/:id/manual-payout error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
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

const money = (n) => `₦${Number(n).toLocaleString()}`;

const joinNotes = (existing, addition) =>
  `${existing ? existing + ' | ' : ''}${addition}`.slice(0, 1000);

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
    console.error('GET /admin/users error:', err);
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
    const { status } = req.query;
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
    console.error('PATCH /admin/auctions/:id/end error:', err);
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
    console.error('DELETE /admin/auctions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST ALL GIGS (optional ?status=active|paused|completed)
router.get('/gigs', async (req, res) => {
  try {
    const { status } = req.query;
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

// LIST ALL TRANSACTIONS
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('buyerId', 'fullName email')
      .populate('sellerId', 'fullName email')
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

module.exports = router;
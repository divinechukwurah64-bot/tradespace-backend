const Auction = require('../models/Auction');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const paystack = require('./paystack');
const notify = require('./notify');

const PAYMENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_BEFORE_MS = 24 * 60 * 60 * 1000;
const MAX_DEFAULTS = 3;

const money = (n) => `₦${Number(n).toLocaleString()}`;
const idOf = (value) => (value ? String(value._id || value) : null);

// Tries to send a payment back. If that fails, flags it so an admin can do it by hand.
const refundSafely = async (tx, reason) => {
  try {
    await paystack.refundTransaction(tx.paystackReference);
    tx.paymentStatus = 'refunded';
    tx.disputeNotes = `Refunded automatically: ${reason}`;
  } catch (err) {
    console.error(
      'Automatic refund failed:',
      err.response && err.response.data ? JSON.stringify(err.response.data) : err.message
    );
    tx.paymentStatus = 'captured';
    tx.disputeStatus = 'filed';
    tx.disputeNotes = `Needs a manual refund: ${reason}`;
  }
  await tx.save();
  return tx;
};

// Confirms a payment with Paystack and updates the auction. Safe to call more than once.
const settleTransaction = async (reference) => {
  const tx = await Transaction.findOne({ paystackReference: reference });
  if (!tx) return null;

  if (['held', 'released', 'refunded'].includes(tx.paymentStatus)) return tx;

  const data = await paystack.verifyTransaction(reference);
  if (!data || data.status !== 'success') return tx;

  // Only one caller can claim the payment, so the webhook and the return page cannot both act on it
  const claimed = await Transaction.findOneAndUpdate(
    { _id: tx._id, paymentStatus: { $in: ['pending', 'failed'] } },
    { $set: { paymentStatus: 'captured', capturedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return Transaction.findById(tx._id);

  if (data.currency !== 'NGN' || Number(data.amount) !== Math.round(claimed.amount * 100)) {
    return refundSafely(claimed, 'the amount paid did not match the price');
  }

  const auction = await Auction.findById(claimed.auctionId);
  const stillOwed =
    auction &&
    auction.status === 'awaiting_payment' &&
    idOf(auction.winnerId) === idOf(claimed.buyerId) &&
    Number(auction.winningBid) === Number(claimed.amount);

  if (!stillOwed) {
    return refundSafely(claimed, 'the auction was no longer waiting for this payment');
  }

  claimed.paymentStatus = 'held';
  await claimed.save();

  auction.status = 'sold';
  auction.paidAt = new Date();
  auction.soldAt = new Date();
  auction.paymentDueAt = null;
  await auction.save();

  await notify(claimed.sellerId, {
    type: 'payment',
    title: 'Payment received',
    message: `${money(claimed.amount)} for "${auction.title}" is paid and held safely. Get the item to the buyer.`,
    link: `/auctions/${auction._id}`
  });
  await notify(claimed.buyerId, {
    type: 'payment',
    title: 'Payment confirmed',
    message: `Your ${money(claimed.amount)} payment for "${auction.title}" is held safely. The seller's contact details are now on the auction page.`,
    link: `/auctions/${auction._id}`
  });

  return claimed;
};

// The winner did not pay in time: strike them and offer the auction to the next highest bidder
const handleMissedPayment = async (auction) => {
  const defaulterId = idOf(auction.winnerId);
  const sellerId = idOf(auction.sellerId);
  const lostAmount = auction.winningBid;

  // Close any checkout they started, so a late payment gets refunded
  await Transaction.updateMany(
    { auctionId: auction._id, buyerId: defaulterId, paymentStatus: 'pending' },
    { $set: { paymentStatus: 'failed' } }
  );

  const updatedUser = await User.findByIdAndUpdate(
    defaulterId,
    { $inc: { paymentDefaults: 1 } },
    { new: true }
  ).select('paymentDefaults');

  const strikes = updatedUser ? updatedUser.paymentDefaults : 1;
  const blocked = strikes >= MAX_DEFAULTS;
  if (blocked) {
    await User.updateOne({ _id: defaulterId }, { $set: { biddingBlocked: true } });
  }

  auction.defaultedBidderIds.push(defaulterId);

  const skip = new Set((auction.defaultedBidderIds || []).map(String));
  skip.add(sellerId);

  const candidates = (auction.bids || [])
    .filter((b) => b.bidderId && !skip.has(String(b.bidderId)))
    .sort((a, b) => b.amount - a.amount || new Date(a.timestamp) - new Date(b.timestamp));

  let next = null;
  for (const candidate of candidates) {
    const user = await User.findById(candidate.bidderId).select('isBanned biddingBlocked');
    if (user && !user.isBanned && !user.biddingBlocked) {
      next = candidate;
      break;
    }
  }

  await notify(defaulterId, {
    type: 'payment',
    title: 'You missed the payment deadline',
    message: `"${auction.title}" was not paid for in time. That is strike ${strikes} of ${MAX_DEFAULTS}.${
      blocked ? ' You can no longer place bids. Contact support to appeal.' : ''
    }`,
    link: `/auctions/${auction._id}`
  });

  if (next) {
    auction.winnerId = next.bidderId;
    auction.winningBid = next.amount;
    auction.currentBid = next.amount;
    auction.paymentDueAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
    auction.paymentReminderSent = false;
    await auction.save();

    await notify(next.bidderId, {
      type: 'payment',
      title: 'You can now win this auction',
      message: `The previous winner did not pay. "${auction.title}" is yours for ${money(next.amount)} if you pay within 3 days.`,
      link: `/auctions/${auction._id}`
    });
    await notify(sellerId, {
      type: 'payment',
      title: 'Winner did not pay',
      message: `"${auction.title}" was offered to the next highest bidder at ${money(next.amount)}. They have 3 days to pay.`,
      link: `/auctions/${auction._id}`
    });
  } else {
    auction.status = 'active';
    auction.winnerId = null;
    auction.winningBid = null;
    auction.soldAt = null;
    auction.paymentDueAt = null;
    auction.paymentReminderSent = false;
    // endsAt stays in the past, so the seller can reopen the auction
    await auction.save();

    await notify(sellerId, {
      type: 'payment',
      title: 'Winner did not pay',
      message: `"${auction.title}" (${money(lostAmount)}) was not paid for and there are no other bidders. It has expired and you can reopen it.`,
      link: `/auctions/${auction._id}`
    });
  }
};

let running = false;

// Sends 24 hour reminders and moves unpaid auctions on
const processPaymentDeadlines = async () => {
  if (running) return;
  running = true;

  try {
    const now = new Date();

    const needReminder = await Auction.find({
      status: 'awaiting_payment',
      paymentReminderSent: false,
      paymentDueAt: { $gt: now, $lte: new Date(now.getTime() + REMINDER_BEFORE_MS) }
    });

    for (const auction of needReminder) {
      await notify(auction.winnerId, {
        type: 'payment',
        title: 'Payment reminder',
        message: `Pay ${money(auction.winningBid)} for "${auction.title}" within 24 hours or it goes to the next bidder and you get a strike.`,
        link: `/auctions/${auction._id}`
      });
      auction.paymentReminderSent = true;
      await auction.save();
    }

    const overdue = await Auction.find({
      status: 'awaiting_payment',
      paymentDueAt: { $lte: now }
    });

    for (const auction of overdue) {
      try {
        await handleMissedPayment(auction);
      } catch (err) {
        console.error(`Could not process the missed payment for auction ${auction._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Payment deadline check failed:', err.message);
  } finally {
    running = false;
  }
};

const startPaymentJobs = () => {
  setInterval(processPaymentDeadlines, 5 * 60 * 1000);
  setTimeout(processPaymentDeadlines, 15 * 1000);
  console.log('Payment deadline check started');
};

module.exports = {
  PAYMENT_WINDOW_MS,
  MAX_DEFAULTS,
  settleTransaction,
  processPaymentDeadlines,
  startPaymentJobs
};
const Auction = require('../models/Auction');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const paystack = require('./paystack');
const notify = require('./notify');

const PAYMENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_BEFORE_MS = 24 * 60 * 60 * 1000;
const MAX_DEFAULTS = 3;

const AUTO_RELEASE_MS = 7 * 24 * 60 * 60 * 1000;
const PAYOUT_RETRY_MS = 30 * 60 * 1000;
const MAX_PAYOUT_ATTEMPTS = 60;

const money = (n) => `₦${Number(n).toLocaleString()}`;
const idOf = (value) => (value ? String(value._id || value) : null);

// Tells every admin about something that needs a human
const notifyAdmins = async (payload) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await notify(admin._id, payload);
    }
  } catch (err) {
    console.error('notifyAdmins error:', err.message);
  }
};

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
  claimed.payoutStatus = 'none';
  claimed.autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_MS);
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

// ---------- Paying the seller ----------

// Approves a payment for release and queues the payout
const queuePayout = async (tx) => {
  tx.inspectionStatus = 'approved';
  tx.payoutStatus = 'queued';
  tx.payoutNextAttemptAt = new Date();
  tx.autoReleaseAt = null;
  await tx.save();
  return tx;
};

// The money reached the seller
const markPaid = async (txId) => {
  const tx = await Transaction.findOneAndUpdate(
    { _id: txId, paymentStatus: 'held', payoutStatus: { $in: ['processing', 'queued'] } },
    {
      $set: {
        payoutStatus: 'paid',
        paymentStatus: 'released',
        releasedAt: new Date(),
        payoutAt: new Date(),
        payoutError: ''
      }
    },
    { new: true }
  );

  if (tx) {
    await notify(tx.sellerId, {
      type: 'payment',
      title: 'You have been paid',
      message: `${money(tx.sellerPayout)} has been sent to your bank account.`,
      link: `/auctions/${tx.auctionId}`
    });
  }
  return tx;
};

// The payout did not work. Try again later, or hand it to an admin after too many tries.
const scheduleRetry = async (txId, message) => {
  const tx = await Transaction.findById(txId);
  if (!tx || tx.payoutStatus === 'paid') return null;

  tx.payoutError = String(message || 'Unknown error').slice(0, 300);

  if (tx.payoutAttempts >= MAX_PAYOUT_ATTEMPTS) {
    tx.payoutStatus = 'failed';
    await tx.save();
    await notifyAdmins({
      type: 'payment',
      title: 'A seller payout failed',
      message: `A ${money(tx.sellerPayout)} payout could not be sent: ${tx.payoutError}`,
      link: '/admin'
    });
    return tx;
  }

  tx.payoutStatus = 'queued';
  tx.payoutNextAttemptAt = new Date(Date.now() + PAYOUT_RETRY_MS);
  await tx.save();
  return tx;
};

// Sends the seller their money. Checks any earlier attempt first, so nobody is paid twice.
const attemptPayout = async (txId) => {
  const tx = await Transaction.findOneAndUpdate(
    {
      _id: txId,
      paymentStatus: 'held',
      payoutStatus: 'queued',
      disputeStatus: { $ne: 'filed' },
      payoutNextAttemptAt: { $lte: new Date() }
    },
    { $set: { payoutStatus: 'processing', payoutStartedAt: new Date() }, $inc: { payoutAttempts: 1 } },
    { new: true }
  );
  if (!tx) return null;

  try {
    if (tx.payoutReference) {
      let previous;
      try {
        previous = await paystack.verifyTransfer(tx.payoutReference);
      } catch (err) {
        await scheduleRetry(tx._id, 'Could not check the earlier payout attempt');
        return null;
      }

      if (previous) {
        if (previous.status === 'success') return markPaid(tx._id);
        if (!['failed', 'reversed'].includes(previous.status)) {
          // Still being processed. Paystack will tell us the result.
          return tx;
        }
      }
    }

    const seller = await User.findById(tx.sellerId).select('+paystackRecipientCode');
    if (!seller || !seller.paystackRecipientCode) {
      await scheduleRetry(tx._id, 'The seller has no payout account');
      return null;
    }

    const reference = `PO-${tx._id}-${tx.payoutAttempts}`;
    await Transaction.updateOne({ _id: tx._id }, { $set: { payoutReference: reference } });

    const result = await paystack.initiateTransfer({
      amountKobo: Math.round(tx.sellerPayout * 100),
      recipient: seller.paystackRecipientCode,
      reference,
      reason: `TradeSpace payout ${tx._id}`
    });

    if (result && result.transfer_code) {
      await Transaction.updateOne({ _id: tx._id }, { $set: { payoutTransferCode: result.transfer_code } });
    }

    if (result && result.status === 'success') return markPaid(tx._id);

    if (result && result.status === 'otp') {
      await scheduleRetry(
        tx._id,
        'Paystack is asking for an OTP. Turn off "Confirm transfers before sending" in Paystack Settings, then Preferences.'
      );
      return null;
    }

    // pending or queued: the webhook or the 15 minute check will confirm the final result
    return tx;
  } catch (err) {
    const message =
      err.response && err.response.data && err.response.data.message
        ? err.response.data.message
        : err.message;
    console.error('Payout attempt failed:', message);
    await scheduleRetry(tx._id, message);
    return null;
  }
};

// Paystack told us how a payout ended
const handleTransferResult = async (reference, outcome, message) => {
  const tx = await Transaction.findOne({ payoutReference: reference });
  if (!tx || tx.payoutStatus === 'paid') return null;

  if (outcome === 'success') return markPaid(tx._id);
  return scheduleRetry(tx._id, message || 'The transfer failed');
};

// A payout has been "processing" for a while. Ask Paystack what happened.
const reconcilePayout = async (tx) => {
  if (!tx.payoutReference) {
    await scheduleRetry(tx._id, 'The payout never started');
    return;
  }

  try {
    const result = await paystack.verifyTransfer(tx.payoutReference);
    if (!result) {
      await scheduleRetry(tx._id, 'Paystack has no record of this payout');
    } else if (result.status === 'success') {
      await markPaid(tx._id);
    } else if (['failed', 'reversed'].includes(result.status)) {
      await scheduleRetry(tx._id, `The transfer ${result.status}`);
    }
  } catch (err) {
    console.error('reconcilePayout error:', err.message);
  }
};

// ---------- Deadlines ----------

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

// Reminders and unpaid auctions
const processPaymentDeadlines = async () => {
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
};

// Held payments the buyer never confirmed or disputed are released after 7 days
const processAutoReleases = async () => {
  const due = await Transaction.find({
    paymentStatus: 'held',
    payoutStatus: 'none',
    disputeStatus: { $ne: 'filed' },
    autoReleaseAt: { $lte: new Date() }
  }).limit(20);

  for (const tx of due) {
    try {
      await queuePayout(tx);
      await notify(tx.sellerId, {
        type: 'payment',
        title: 'Payment released',
        message: `The buyer did not report a problem, so ${money(tx.sellerPayout)} is being sent to your bank.`,
        link: `/auctions/${tx.auctionId}`
      });
      await notify(tx.buyerId, {
        type: 'payment',
        title: 'Payment released to the seller',
        message: 'You did not report a problem within 7 days, so the seller has been paid.',
        link: `/auctions/${tx.auctionId}`
      });
    } catch (err) {
      console.error('Auto release failed:', err.message);
    }
  }
};

// Sends queued payouts and checks stuck ones
const processPayouts = async () => {
  const now = new Date();

  const due = await Transaction.find({
    paymentStatus: 'held',
    payoutStatus: 'queued',
    disputeStatus: { $ne: 'filed' },
    payoutNextAttemptAt: { $lte: now }
  })
    .select('_id')
    .limit(20);

  for (const tx of due) {
    await attemptPayout(tx._id);
  }

  const stuck = await Transaction.find({
    paymentStatus: 'held',
    payoutStatus: 'processing',
    payoutStartedAt: { $lte: new Date(now.getTime() - 15 * 60 * 1000) }
  }).limit(20);

  for (const tx of stuck) {
    await reconcilePayout(tx);
  }
};

let running = false;

const runJobs = async () => {
  if (running) return;
  running = true;

  try {
    await processPaymentDeadlines();
    await processAutoReleases();
    await processPayouts();
  } catch (err) {
    console.error('Payment jobs failed:', err.message);
  } finally {
    running = false;
  }
};

const startPaymentJobs = () => {
  setInterval(runJobs, 5 * 60 * 1000);
  setTimeout(runJobs, 15 * 1000);
  console.log('Payment deadline check started');
};

module.exports = {
  PAYMENT_WINDOW_MS,
  AUTO_RELEASE_MS,
  MAX_DEFAULTS,
  notifyAdmins,
  settleTransaction,
  queuePayout,
  attemptPayout,
  handleTransferResult,
  startPaymentJobs
};
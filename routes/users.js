const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const Review = require('../models/Review');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const paystack = require('../utils/paystack');
const secretBox = require('../utils/secretBox');

const router = express.Router();

// Old photos live on ImgBB. New ones live in our own storage, under profile/<user id>/.
const OLD_IMAGE_URL = /^https:\/\/([a-z0-9-]+\.)?ibb\.co\/\S+$/i;
const PHONE = /^[0-9+\-()\s]{6,20}$/;
const ACCOUNT_NUMBER = /^\d{10}$/;

const isAllowedProfileImage = (url, userId) => {
  if (typeof url !== 'string' || url.length > 500 || /\s/.test(url)) return false;
  if (OLD_IMAGE_URL.test(url)) return true;

  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  return !!base && url.startsWith(`${base}/profile/${String(userId)}/`);
};

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

// Limits how often one user can hit Paystack lookups or guess a password: 10 per 10 minutes
const attempts = new Map();
const allowAttempt = (userId) => {
  const now = Date.now();
  const recent = (attempts.get(userId) || []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  if (recent.length >= 10) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
};

// Clears old entries so the list does not grow forever
setInterval(() => {
  const cutoff = Date.now() - ATTEMPT_WINDOW_MS;
  for (const [key, times] of attempts) {
    if (!times.length || times[times.length - 1] < cutoff) {
      attempts.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

const findBank = async (bankCode) => {
  const banks = await paystack.listBanks();
  return banks.find((b) => b.code === bankCode) || null;
};

// In test mode Paystack may not resolve test accounts, so fall back to the user's own name
const lookupAccountName = async (user, bankCode, accountNumber) => {
  try {
    return await paystack.resolveAccount(accountNumber, bankCode);
  } catch (err) {
    if (paystack.isTestMode() && paystack.isLookupFailure(err)) {
      return user.fullName;
    }
    throw err;
  }
};

const sendBankError = (err, res, label) => {
  if (paystack.isLookupFailure(err)) {
    return res.status(400).json({
      error: 'We could not verify that account. Check the bank and account number and try again.'
    });
  }
  console.error(
    `${label} error:`,
    err.response && err.response.data ? JSON.stringify(err.response.data) : err.message
  );
  return res.status(503).json({ error: 'Bank verification is unavailable right now' });
};

// UPDATE MY PROFILE - name, bio, phone and profile picture
router.put('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { fullName, bio, phone, profileImage } = req.body;

    if (fullName !== undefined) {
      const name = typeof fullName === 'string' ? fullName.trim() : '';
      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ error: 'Name must be between 2 and 60 characters' });
      }
      user.fullName = name;
    }

    if (bio !== undefined) {
      const text = typeof bio === 'string' ? bio.trim() : '';
      if (text.length > 300) {
        return res.status(400).json({ error: 'Bio cannot be longer than 300 characters' });
      }
      user.bio = text;
    }

    if (phone !== undefined) {
      const number = typeof phone === 'string' ? phone.trim() : '';
      if (number && !PHONE.test(number)) {
        return res.status(400).json({ error: 'Enter a valid phone number' });
      }
      user.phone = number;
    }

    if (profileImage !== undefined) {
      if (profileImage === null || profileImage === '') {
        user.profileImage = null;
      } else if (isAllowedProfileImage(profileImage, user._id)) {
        user.profileImage = profileImage;
      } else {
        return res.status(400).json({ error: 'Profile picture must be uploaded through TradeSpace' });
      }
    }

    user.updatedAt = new Date();
    await user.save();

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      bio: user.bio
    });
  } catch (err) {
    console.error('PUT /users/me error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST OF NIGERIAN BANKS
router.get('/banks', auth, async (req, res) => {
  try {
    res.json(await paystack.listBanks());
  } catch (err) {
    sendBankError(err, res, 'GET /users/banks');
  }
});

// MY SAVED PAYOUT ACCOUNT - only the bank, the name and the last 4 digits
router.get('/me/bank', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('+paystackRecipientCode');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      hasBank: !!user.paystackRecipientCode,
      bankName: user.bankName,
      accountName: user.bankAccountName,
      accountLast4: user.bankAccountLast4
    });
  } catch (err) {
    console.error('GET /users/me/bank error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CHECK AN ACCOUNT - shows the name on the account so the seller can confirm it is theirs
router.post('/me/bank/resolve', auth, async (req, res) => {
  try {
    const { bankCode, accountNumber } = req.body;

    if (typeof bankCode !== 'string' || typeof accountNumber !== 'string' || !ACCOUNT_NUMBER.test(accountNumber)) {
      return res.status(400).json({ error: 'Choose a bank and enter a 10 digit account number' });
    }

    if (!allowAttempt(req.user.userId)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }

    const bank = await findBank(bankCode);
    if (!bank) {
      return res.status(400).json({ error: 'Choose a bank from the list' });
    }

    const user = await User.findById(req.user.userId).select('fullName');
    const accountName = await lookupAccountName(user, bankCode, accountNumber);

    res.json({ accountName, bankName: bank.name });
  } catch (err) {
    sendBankError(err, res, 'POST /users/me/bank/resolve');
  }
});

// SAVE MY PAYOUT ACCOUNT - needs the password, because this decides where the money goes
router.put('/me/bank', auth, async (req, res) => {
  try {
    const { bankCode, accountNumber, password } = req.body;

    if (typeof bankCode !== 'string' || typeof accountNumber !== 'string' || !ACCOUNT_NUMBER.test(accountNumber)) {
      return res.status(400).json({ error: 'Choose a bank and enter a 10 digit account number' });
    }
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Enter your password to save payout details' });
    }

    if (!allowAttempt(req.user.userId)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const bank = await findBank(bankCode);
    if (!bank) {
      return res.status(400).json({ error: 'Choose a bank from the list' });
    }

    // The server checks the name itself and never trusts one sent from the browser
    const accountName = await lookupAccountName(user, bankCode, accountNumber);
    const recipientCode = await paystack.createRecipient({
      name: accountName,
      accountNumber,
      bankCode
    });

    user.bankName = bank.name;
    user.bankCode = bankCode;
    user.bankAccountName = accountName;
    user.bankAccountLast4 = accountNumber.slice(-4);
    user.bankAccountNumber = null;
    user.paystackRecipientCode = recipientCode;

    // The full number is kept encrypted, so a payout can be sent by hand
    if (secretBox.isConfigured()) {
      user.bankAccountEncrypted = secretBox.encryptText(accountNumber);
    } else {
      console.error('BANK_ENCRYPTION_KEY is not set, so the full account number was not stored');
    }

    user.updatedAt = new Date();
    await user.save();

    res.json({
      hasBank: true,
      bankName: user.bankName,
      accountName: user.bankAccountName,
      accountLast4: user.bankAccountLast4
    });
  } catch (err) {
    sendBankError(err, res, 'PUT /users/me/bank');
  }
});

// DELETE MY ACCOUNT - needs the password.
// The account is anonymised, not erased, so old bids, reviews and sales keep working.
// It is refused while money or an open deal is tied to the account.
router.post('/me/delete', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Enter your password to delete your account' });
    }

    if (!allowAttempt(req.user.userId)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted from here' });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const userId = user._id;
    const now = new Date();
    const openDeal = { $or: [{ paymentStatus: { $in: ['captured', 'held'] } }, { disputeStatus: 'filed' }] };

    const [sellingNow, wonAuctions, liveBids, sellerDeals] = await Promise.all([
      Auction.countDocuments({ sellerId: userId, status: { $in: ['active', 'awaiting_payment'] } }),
      Auction.find({ winnerId: userId }).select('_id status'),
      Auction.countDocuments({ status: 'active', endsAt: { $gt: now }, 'bids.bidderId': userId }),
      Transaction.countDocuments({ sellerId: userId, ...openDeal })
    ]);

    const wonIds = wonAuctions.map((a) => a._id);
    const unpaidWins = wonAuctions.filter((a) => a.status === 'awaiting_payment').length;
    const buyerDeals = wonIds.length
      ? await Transaction.countDocuments({ auctionId: { $in: wonIds }, ...openDeal })
      : 0;

    const reasons = [];
    if (sellingNow > 0) reasons.push('you have auctions that are still running or waiting for payment');
    if (liveBids > 0) reasons.push('you have bids on auctions that are still running');
    if (unpaidWins > 0) reasons.push('you have won an auction you have not paid for yet');
    if (sellerDeals > 0 || buyerDeals > 0) {
      reasons.push('you have a sale with money held or a problem still being reviewed');
    }

    if (reasons.length > 0) {
      return res.status(409).json({
        error: `You cannot delete your account yet because ${reasons.join(', and ')}. Finish those first, then try again.`
      });
    }

    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    // Your gigs are removed. Nothing else is deleted.
    await Gig.deleteMany({ sellerId: userId });

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          fullName: 'Deleted user',
          email: `deleted-${userId}@deleted.invalid`,
          password: randomHash,
          phone: '',
          bio: '',
          profileImage: null,
          bankName: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankAccountLast4: null,
          bankCode: null,
          bankAccountEncrypted: null,
          paystackRecipientCode: null,
          blockedUsers: [],
          isVerified: false,
          passwordResetTokenHash: null,
          passwordResetExpires: null,
          deletedAt: now,
          // Logs out every device that still has a token
          passwordChangedAt: now,
          updatedAt: now
        }
      }
    );

    console.log(`Account ${userId} was deleted by its owner`);

    res.json({ message: 'Your account has been deleted' });
  } catch (err) {
    console.error('POST /users/me/delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ADMIN ONLY - the payout account of the seller on one sale, so the admin can pay them by hand.
// The full number is decrypted here and sent to nobody else.
router.get('/admin/seller-account/:txId', auth, admin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.txId)) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    const tx = await Transaction.findById(req.params.txId).select('sellerId');
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const seller = await User.findById(tx.sellerId).select(
      'bankName bankAccountName bankAccountLast4 +bankAccountEncrypted'
    );
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    let accountNumber = null;
    if (seller.bankAccountEncrypted) {
      if (!secretBox.isConfigured()) {
        return res.status(409).json({ error: 'The server has no BANK_ENCRYPTION_KEY set, so the number cannot be read' });
      }
      try {
        accountNumber = secretBox.decryptText(seller.bankAccountEncrypted);
      } catch (err) {
        console.error('Could not decrypt a stored account number:', err.message);
        return res.status(409).json({
          error: 'The stored account number cannot be read. The encryption key may have changed. Ask the seller to save their payout account again.'
        });
      }
    }

    console.log(`Admin ${req.user.userId} viewed the payout account for transaction ${tx._id}`);

    res.set('Cache-Control', 'no-store');
    res.json({
      bankName: seller.bankName,
      accountName: seller.bankAccountName,
      accountLast4: seller.bankAccountLast4,
      accountNumber
    });
  } catch (err) {
    console.error('GET /users/admin/seller-account error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUBLIC PROFILE - never includes email, phone or bank details.
// Sold items are never listed here, only counted, and reviews do not say which item they were for.
// Auctions waiting for payment are listed with their status, but never who the winner is.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id).select(
      'fullName profileImage bio createdAt isBanned isVerified deletedAt'
    );
    if (!user || user.isBanned || user.deletedAt) {
      return res.status(404).json({ error: 'User not found' });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    const [ratingAgg, itemsSold, activeListings, activeGigs, reviews, listings] = await Promise.all([
      Review.aggregate([
        { $match: { sellerId: objectId } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]),
      // Paid sales only. A refunded sale does not count.
      Transaction.countDocuments({
        sellerId: objectId,
        auctionId: { $ne: null },
        paymentStatus: { $in: ['held', 'released'] }
      }),
      Auction.countDocuments({ sellerId: id, status: 'active' }),
      Gig.countDocuments({ sellerId: id, status: 'active' }),
      Review.find({ sellerId: id })
        .select('rating comment createdAt reviewerId')
        .populate('reviewerId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(20),
      Auction.find({ sellerId: id, status: { $in: ['active', 'awaiting_payment'] } })
        .select('title images currentBid startingBid status endsAt isLive')
        .sort({ createdAt: -1 })
        .limit(12)
    ]);

    const rating = ratingAgg[0] ? Math.round(ratingAgg[0].average * 10) / 10 : null;
    const ratingCount = ratingAgg[0] ? ratingAgg[0].count : 0;

    res.json({
      _id: user._id,
      fullName: user.fullName,
      profileImage: user.profileImage,
      bio: user.bio,
      isVerified: user.isVerified,
      joinedAt: user.createdAt,
      stats: { rating, ratingCount, itemsSold, activeListings, activeGigs },
      reviews,
      listings
    });
  } catch (err) {
    console.error('GET /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
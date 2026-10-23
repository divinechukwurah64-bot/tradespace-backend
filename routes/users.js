const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const paystack = require('../utils/paystack');

const router = express.Router();

const IMAGE_URL = /^https:\/\/([a-z0-9-]+\.)?ibb\.co\/\S+$/i;
const PHONE = /^[0-9+\-()\s]{6,20}$/;
const ACCOUNT_NUMBER = /^\d{10}$/;

// Limits how often one user can hit Paystack lookups or guess a password: 10 per 10 minutes
const attempts = new Map();
const allowAttempt = (userId) => {
  const now = Date.now();
  const recent = (attempts.get(userId) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 10) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
};

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
      } else if (
        typeof profileImage === 'string' &&
        profileImage.length <= 500 &&
        IMAGE_URL.test(profileImage)
      ) {
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

// PUBLIC PROFILE - never includes email, phone or bank details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(id).select('fullName profileImage bio createdAt isBanned isVerified');
    if (!user || user.isBanned) {
      return res.status(404).json({ error: 'User not found' });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    const [ratingAgg, itemsSold, activeListings, activeGigs, reviews, listings] = await Promise.all([
      Review.aggregate([
        { $match: { sellerId: objectId } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]),
      Auction.countDocuments({ sellerId: id, status: 'sold' }),
      Auction.countDocuments({ sellerId: id, status: 'active' }),
      Gig.countDocuments({ sellerId: id, status: 'active' }),
      Review.find({ sellerId: id })
        .populate('reviewerId', 'fullName')
        .populate('auctionId', 'title')
        .sort({ createdAt: -1 })
        .limit(20),
      Auction.find({ sellerId: id, status: { $in: ['active', 'sold'] } })
        .select('title images currentBid startingBid winningBid status endsAt isLive')
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
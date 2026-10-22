const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const Review = require('../models/Review');
const auth = require('../middleware/auth');

const router = express.Router();

const IMAGE_URL = /^https:\/\/([a-z0-9-]+\.)?ibb\.co\/\S+$/i;
const PHONE = /^[0-9+\-()\s]{6,20}$/;

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
const express = require('express');
const mongoose = require('mongoose');
const Gig = require('../models/Gig');
const auth = require('../middleware/auth');

const router = express.Router();

// Public responses never include email addresses or phone numbers
const SELLER_FIELDS = 'fullName profileImage';

// Input limits
const MIN_PRICE = 500;
const MAX_AMOUNT = 1000000000;
const MIN_DELIVERY_DAYS = 1;
const MAX_DELIVERY_DAYS = 365;
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
const MAX_SHORT_TEXT = 60;
const MAX_IMAGES = 10;
const MAX_IMAGE_URL = 500;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

const loadGig = (id) => Gig.findById(id).populate('sellerId', SELLER_FIELDS);

const provided = (value) => value !== undefined && value !== null && value !== '';

const isTextWithin = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

// Only plain numbers and numeric strings count. Arrays and objects become NaN.
const toAmount = (value) =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
    ? Number(value)
    : NaN;

// Returns a clean list of https image links, or null if anything is wrong
const parseImages = (value) => {
  if (!Array.isArray(value) || value.length > MAX_IMAGES) return null;
  const urls = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length > MAX_IMAGE_URL || !/^https:\/\//i.test(item)) {
      return null;
    }
    urls.push(item);
  }
  return urls;
};

// Returns a clean list of short tags, or null if anything is wrong
const parseTags = (value) => {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const tags = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const tag = item.trim();
    if (!tag || tag.length > MAX_TAG_LENGTH) return null;
    tags.push(tag);
  }
  return tags;
};

// Returns a whole number in range, or null
const parseWholeNumber = (value, min, max) => {
  const n = toAmount(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
};

// GET ALL GIGS
router.get('/', async (req, res) => {
  try {
    const gigs = await Gig.find()
      .populate('sellerId', SELLER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(gigs);
  } catch (err) {
    console.error('GET /gigs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET GIGS BY CATEGORY
router.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    if (!isTextWithin(category, MAX_SHORT_TEXT)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const gigs = await Gig.find({ category })
      .populate('sellerId', SELLER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(gigs);
  } catch (err) {
    console.error('GET /gigs/category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET SELLER'S GIGS
router.get('/seller/:sellerId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.sellerId)) {
      return res.status(400).json({ error: 'Invalid seller' });
    }

    const gigs = await Gig.find({ sellerId: req.params.sellerId })
      .populate('sellerId', SELLER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(gigs);
  } catch (err) {
    console.error('GET /gigs/seller error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE GIG
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const gig = await loadGig(req.params.id);

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    res.json(gig);
  } catch (err) {
    console.error('GET /gigs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE GIG - Auth required
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, deliveryDays, images, tags } = req.body;

    if (
      !provided(title) ||
      !provided(description) ||
      !provided(category) ||
      !provided(req.body.startingPrice)
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (
      !isTextWithin(title, MAX_TITLE) ||
      !isTextWithin(description, MAX_DESCRIPTION) ||
      !isTextWithin(category, MAX_SHORT_TEXT)
    ) {
      return res.status(400).json({ error: 'Title, description or category is invalid or too long' });
    }

    const startingPrice = toAmount(req.body.startingPrice);
    if (!Number.isSafeInteger(startingPrice) || startingPrice < MIN_PRICE) {
      return res.status(400).json({ error: 'Starting price must be a whole number of at least ₦500' });
    }
    if (startingPrice > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Starting price is too high' });
    }

    let cleanDeliveryDays = 3;
    if (provided(deliveryDays)) {
      cleanDeliveryDays = parseWholeNumber(deliveryDays, MIN_DELIVERY_DAYS, MAX_DELIVERY_DAYS);
      if (cleanDeliveryDays === null) {
        return res.status(400).json({ error: 'Delivery time must be a whole number of days from 1 to 365' });
      }
    }

    let cleanImages = [];
    if (provided(images)) {
      cleanImages = parseImages(images);
      if (!cleanImages) {
        return res.status(400).json({ error: 'Invalid images' });
      }
    }

    let cleanTags = [];
    if (provided(tags)) {
      cleanTags = parseTags(tags);
      if (!cleanTags) {
        return res.status(400).json({ error: 'Invalid tags' });
      }
    }

    const gig = new Gig({
      sellerId: req.user.userId,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      startingPrice,
      deliveryDays: cleanDeliveryDays,
      images: cleanImages,
      tags: cleanTags,
      status: 'active',
    });

    await gig.save();

    const populatedGig = await loadGig(gig._id);

    res.status(201).json(populatedGig);
  } catch (err) {
    console.error('POST /gigs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE GIG - Only seller can update
router.put('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only update your own gigs' });
    }

    const { title, description, category, deliveryDays, images, tags } = req.body;

    if (provided(title)) {
      if (!isTextWithin(title, MAX_TITLE)) {
        return res.status(400).json({ error: 'Title is invalid or too long' });
      }
      gig.title = title.trim();
    }

    if (provided(description)) {
      if (!isTextWithin(description, MAX_DESCRIPTION)) {
        return res.status(400).json({ error: 'Description is invalid or too long' });
      }
      gig.description = description.trim();
    }

    if (provided(category)) {
      if (!isTextWithin(category, MAX_SHORT_TEXT)) {
        return res.status(400).json({ error: 'Category is invalid or too long' });
      }
      gig.category = category.trim();
    }

    if (provided(req.body.startingPrice)) {
      const startingPrice = toAmount(req.body.startingPrice);
      if (!Number.isSafeInteger(startingPrice) || startingPrice < MIN_PRICE) {
        return res.status(400).json({ error: 'Starting price must be a whole number of at least ₦500' });
      }
      if (startingPrice > MAX_AMOUNT) {
        return res.status(400).json({ error: 'Starting price is too high' });
      }
      gig.startingPrice = startingPrice;
    }

    if (provided(deliveryDays)) {
      const cleanDeliveryDays = parseWholeNumber(deliveryDays, MIN_DELIVERY_DAYS, MAX_DELIVERY_DAYS);
      if (cleanDeliveryDays === null) {
        return res.status(400).json({ error: 'Delivery time must be a whole number of days from 1 to 365' });
      }
      gig.deliveryDays = cleanDeliveryDays;
    }

    if (provided(images)) {
      const cleanImages = parseImages(images);
      if (!cleanImages) {
        return res.status(400).json({ error: 'Invalid images' });
      }
      gig.images = cleanImages;
    }

    if (provided(tags)) {
      const cleanTags = parseTags(tags);
      if (!cleanTags) {
        return res.status(400).json({ error: 'Invalid tags' });
      }
      gig.tags = cleanTags;
    }

    await gig.save();

    const populatedGig = await loadGig(gig._id);

    res.json(populatedGig);
  } catch (err) {
    console.error('PUT /gigs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE GIG - Only seller can delete
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own gigs' });
    }

    await Gig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Gig deleted successfully' });
  } catch (err) {
    console.error('DELETE /gigs/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
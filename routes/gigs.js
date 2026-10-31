const express = require('express');
const Gig = require('../models/Gig');
const auth = require('../middleware/auth');

const router = express.Router();

// Public responses never include email addresses or phone numbers
const SELLER_FIELDS = 'fullName profileImage';

const loadGig = (id) => Gig.findById(id).populate('sellerId', SELLER_FIELDS);

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
    const gigs = await Gig.find({ category: req.params.category })
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
    const { title, description, category, startingPrice, deliveryDays, images, tags } = req.body;

    if (!title || !description || !category || !startingPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (startingPrice < 500) {
      return res.status(400).json({ error: 'Starting price must be at least ₦500' });
    }

    const gig = new Gig({
      sellerId: req.user.userId,
      title,
      description,
      category,
      startingPrice,
      deliveryDays: deliveryDays || 3,
      images: images || [],
      tags: tags || [],
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
    const gig = await Gig.findById(req.params.id);

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You  can only update your own gigs' });
    }

    const { title, description, category, startingPrice, deliveryDays, images, tags } = req.body;

    if (title) gig.title = title;
    if (description) gig.description = description;
    if (category) gig.category = category;
    if (startingPrice && startingPrice >= 500) gig.startingPrice = startingPrice;
    if (deliveryDays) gig.deliveryDays = deliveryDays;
    if (images) gig.images = images;
    if (tags) gig.tags = tags;

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
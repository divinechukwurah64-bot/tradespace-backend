const express = require('express');
const router = express.Router();
const Gig = require('../models/Gig');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
   const { title, description, category, startingPrice, images } = req.body;
    
    if (!title || !description || !category || !startingPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const gig = new Gig({
      sellerId: req.user.userId,
      title,
      description,
      category,
      startingPrice,
      images: images || []
    });
    
    await gig.save();
    
    res.status(201).json({
      message: 'Gig created successfully',
      gig
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const gigs = await Gig.find({ status: 'active' })
      .populate('sellerId', 'fullName rating')
      .sort({ createdAt: -1 });
    
    res.json(gigs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .populate('sellerId', 'fullName rating email phone')
      .populate('reviews.buyerId', 'fullName');
    
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    
    res.json(gig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/user/my-gigs', authMiddleware, async (req, res) => {
  try {
    const gigs = await Gig.find({ sellerId: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json(gigs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const gigId = req.params.id;
    const gig = await Gig.findById(gigId);

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only seller can delete this gig' });
    }

    await Gig.findByIdAndDelete(gigId);

    res.json({ message: 'Gig deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
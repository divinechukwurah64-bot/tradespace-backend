const express = require('express');
const mongoose = require('mongoose');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');

const router = express.Router();

const isConfigured = () =>
  process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET;

const roomName = (auctionId) => `auction-${auctionId}`;

// The server SDK talks over https, the browser connects over wss
const httpUrl = () => process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

const makeToken = async ({ identity, room, canPublish }) => {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    ttl: '2h'
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: canPublish
  });
  return await at.toJwt();
};

const requireConfigured = (req, res, next) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Live streaming is not configured' });
  }
  next();
};

// LIST LIVE AUCTIONS (public)
router.get('/', async (req, res) => {
  try {
    const auctions = await Auction.find({ isLive: true, status: 'active' })
      .select('title images currentBid startingBid sellerId liveStartedAt')
      .populate('sellerId', 'fullName')
      .sort({ liveStartedAt: -1 })
      .limit(50);
    res.json(auctions);
  } catch (err) {
    console.error('GET /live error:', err);
    res.status(500).json({ error: err.message });
  }
});

// START A STREAM - only the seller of the auction
router.post('/:id/start', auth, requireConfigured, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can start a live stream' });
    }

    if (auction.status !== 'active' || new Date() > new Date(auction.endsAt)) {
      return res.status(400).json({ error: 'This auction has ended' });
    }

    auction.isLive = true;
    auction.liveStartedAt = auction.liveStartedAt || new Date();
    await auction.save();

    const token = await makeToken({
      identity: req.user.userId,
      room: roomName(auction._id),
      canPublish: true
    });

    res.json({ token, url: process.env.LIVEKIT_URL, room: roomName(auction._id) });
  } catch (err) {
    console.error('POST /live/:id/start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// WATCH A STREAM - any logged in user, view only
router.post('/:id/watch', auth, requireConfigured, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(req.params.id).select('isLive status');
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (!auction.isLive || auction.status !== 'active') {
      return res.status(400).json({ error: 'This auction is not live right now' });
    }

    const token = await makeToken({
      identity: req.user.userId,
      room: roomName(auction._id),
      canPublish: false
    });

    res.json({ token, url: process.env.LIVEKIT_URL, room: roomName(auction._id) });
  } catch (err) {
    console.error('POST /live/:id/watch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// END A STREAM - the seller or an admin
router.post('/:id/end', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const isSeller = auction.sellerId.toString() === req.user.userId;
    if (!isSeller && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the seller or an admin can end this stream' });
    }

    auction.isLive = false;
    auction.liveStartedAt = null;
    await auction.save();

    // Kick everyone out of the room. If the room is already gone this can fail, which is fine.
    if (isConfigured()) {
      try {
        const service = new RoomServiceClient(
          httpUrl(),
          process.env.LIVEKIT_API_KEY,
          process.env.LIVEKIT_API_SECRET
        );
        await service.deleteRoom(roomName(auction._id));
      } catch (e) {
        console.log('deleteRoom note:', e.message);
      }
    }

    res.json({ message: 'Stream ended' });
  } catch (err) {
    console.error('POST /live/:id/end error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
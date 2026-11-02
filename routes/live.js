const express = require('express');
const mongoose = require('mongoose');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const Auction = require('../models/Auction');
const auth = require('../middleware/auth');

const router = express.Router();

const LIVE_CACHE_MS = 10 * 1000;
const START_GRACE_MS = 3 * 60 * 1000;

const isConfigured = () =>
  process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET;

const roomName = (auctionId) => `auction-${auctionId}`;

// The server SDK talks over https, the browser connects over wss
const httpUrl = () => process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

const roomService = () =>
  new RoomServiceClient(httpUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

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

// ---------- The list of live streams, shared by the list page and the navbar count ----------

let liveCache = { at: 0, data: [] };

const clearLiveCache = () => {
  liveCache = { at: 0, data: [] };
};

const loadLive = async () => {
  const now = Date.now();

  const auctions = await Auction.find({
    isLive: true,
    status: 'active',
    endsAt: { $gt: new Date(now) }
  })
    .select('title images category currentBid startingBid sellerId liveStartedAt endsAt')
    .populate('sellerId', 'fullName profileImage')
    .sort({ liveStartedAt: -1 })
    .limit(50)
    .lean();

  // Ask LiveKit which rooms really exist. If it cannot be reached, trust the database flag.
  let rooms = null;
  if (isConfigured() && auctions.length > 0) {
    try {
      const list = await roomService().listRooms(auctions.map((a) => roomName(a._id)));
      rooms = new Map(list.map((r) => [r.name, r]));
    } catch (e) {
      console.log('listRooms note:', e.message);
    }
  }

  const result = [];
  for (const a of auctions) {
    let viewers = null;

    if (rooms) {
      const room = rooms.get(roomName(a._id));
      const participants = room ? Number(room.numParticipants) || 0 : 0;

      if (participants < 1) {
        // The seller may still be connecting, so a new stream is kept for a few minutes
        const startedAgo = a.liveStartedAt ? now - new Date(a.liveStartedAt).getTime() : Infinity;
        if (startedAgo > START_GRACE_MS) continue;
        viewers = 0;
      } else {
        // The seller counts as one participant
        viewers = Math.max(0, participants - 1);
      }
    }

    result.push({
      _id: a._id,
      title: a.title,
      images: a.images && a.images.length > 0 ? [a.images[0]] : [],
      category: a.category,
      currentBid: a.currentBid,
      startingBid: a.startingBid,
      sellerId: a.sellerId
        ? {
            _id: a.sellerId._id,
            fullName: a.sellerId.fullName,
            profileImage: a.sellerId.profileImage || null
          }
        : null,
      liveStartedAt: a.liveStartedAt,
      endsAt: a.endsAt,
      viewers
    });
  }

  return result;
};

const getLive = async () => {
  if (Date.now() - liveCache.at < LIVE_CACHE_MS) {
    return liveCache.data;
  }
  const data = await loadLive();
  liveCache = { at: Date.now(), data };
  return data;
};

// LIST LIVE AUCTIONS (public)
router.get('/', async (req, res) => {
  try {
    res.json(await getLive());
  } catch (err) {
    console.error('GET /live error:', err);
    res.status(500).json({ error: err.message });
  }
});

// HOW MANY ARE LIVE RIGHT NOW (public, used by the navbar)
router.get('/count', async (req, res) => {
  try {
    const data = await getLive();
    res.json({ count: data.length });
  } catch (err) {
    console.error('GET /live/count error:', err);
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
    clearLiveCache();

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

// END A STREAM - only the seller
router.post('/:id/end', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid auction' });
    }

    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can end this stream' });
    }

    auction.isLive = false;
    auction.liveStartedAt = null;
    await auction.save();
    clearLiveCache();

    // Kick everyone out of the room. If the room is already gone this can fail, which is fine.
    if (isConfigured()) {
      try {
        await roomService().deleteRoom(roomName(auction._id));
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
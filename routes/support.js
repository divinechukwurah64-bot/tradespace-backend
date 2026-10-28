const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Gig = require('../models/Gig');
const Comment = require('../models/Comment');
const SupportTicket = require('../models/SupportTicket');
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const notify = require('../utils/notify');
const sendEmail = require('../utils/sendEmail');
const { notifyAdmins } = require('../utils/payments');

const router = express.Router();

const TOPICS = [
  'Payment problem',
  'Problem with an order',
  'My account',
  'Report a bug',
  'Suggestion',
  'Other'
];

const REASONS = [
  'Scam or fraud',
  'Fake or misleading item',
  'Prohibited item',
  'Harassment or abuse',
  'Spam',
  'Other'
];

const TARGET_TYPES = ['auction', 'comment', 'user', 'gig'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Reads the user id from the token if there is one, without requiring a login
const optionalUserId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch (err) {
    return null;
  }
};

// Simple limit on how often one person can send things
const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
};

// WHAT TO SHOW ON THE SUPPORT PAGE
router.get('/info', (req, res) => {
  res.json({ email: process.env.SUPPORT_EMAIL || null });
});

// SEND A SUPPORT REQUEST - works logged in or not, so people locked out can still ask for help
router.post('/tickets', async (req, res) => {
  try {
    const topic = String(req.body.topic || '');
    const message = String(req.body.message || '').trim();
    const link = String(req.body.link || '').trim().slice(0, 300);

    if (!TOPICS.includes(topic)) {
      return res.status(400).json({ error: 'Choose a topic' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Please tell us a little more (at least 10 characters)' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Your message cannot be longer than 2000 characters' });
    }

    let userId = null;
    let name = '';
    let email = '';

    const uid = optionalUserId(req);
    if (uid) {
      const user = await User.findById(uid).select('fullName email isBanned');
      if (user) {
        userId = user._id;
        name = user.fullName;
        email = user.email;
      }
    }

    if (!email) {
      email = String(req.body.email || '').trim().toLowerCase();
      name = String(req.body.name || '').trim().slice(0, 80) || 'Guest';
      if (!EMAIL.test(email) || email.length > 200) {
        return res.status(400).json({ error: 'Enter a valid email so we can reply to you' });
      }
    }

    if (limited(`ticket:${userId || req.ip}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'You have sent several requests already. Please wait a while before sending another.' });
    }

    const ticket = await SupportTicket.create({ userId, name, email, topic, message, link });

    await notifyAdmins({
      type: 'support',
      title: 'New support request',
      message: `${topic}: ${message.slice(0, 100)}`,
      link: '/admin/inbox'
    });

    if (process.env.SUPPORT_EMAIL) {
      try {
        await sendEmail({
          to: process.env.SUPPORT_EMAIL,
          subject: `[TradeSpace support] ${topic}`,
          text: `From: ${name} <${email}>\nTopic: ${topic}\n${link ? `Link: ${link}\n` : ''}\n${message}\n\nTicket: ${ticket._id}`,
          html:
            `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br>` +
            `<strong>Topic:</strong> ${escapeHtml(topic)}` +
            (link ? `<br><strong>Link:</strong> ${escapeHtml(link)}` : '') +
            `</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` +
            `<p style="color:#6b7280">Ticket ${ticket._id}</p>`
        });
      } catch (mailErr) {
        console.error('Could not email the support request:', mailErr.message);
      }
    }

    res.status(201).json({ message: 'Thanks. We have your request and will reply as soon as we can.' });
  } catch (err) {
    console.error('POST /support/tickets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// MY SUPPORT REQUESTS, with any reply from the team
router.get('/tickets/mine', auth, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user.userId })
      .select('topic message status adminNote createdAt')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(tickets);
  } catch (err) {
    console.error('GET /support/tickets/mine error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REPORT SOMETHING - an auction, a comment, a gig or a person
router.post('/reports', auth, async (req, res) => {
  try {
    const { targetType, targetId, reason } = req.body;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!TARGET_TYPES.includes(targetType) || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ error: 'Invalid report' });
    }
    if (!REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Choose a reason' });
    }
    if (note.length > 500) {
      return res.status(400).json({ error: 'Your note cannot be longer than 500 characters' });
    }

    if (limited(`report:${req.user.userId}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'You have sent several reports already. Please wait a while.' });
    }

    let ownerId = null;
    let auctionId = null;

    if (targetType === 'auction') {
      const auction = await Auction.findById(targetId).select('sellerId');
      if (!auction) return res.status(404).json({ error: 'Auction not found' });
      ownerId = auction.sellerId;
    } else if (targetType === 'gig') {
      const gig = await Gig.findById(targetId).select('sellerId');
      if (!gig) return res.status(404).json({ error: 'Gig not found' });
      ownerId = gig.sellerId;
    } else if (targetType === 'comment') {
      const comment = await Comment.findById(targetId).select('userId auctionId');
      if (!comment) return res.status(404).json({ error: 'Comment not found' });
      ownerId = comment.userId;
      auctionId = comment.auctionId;
    } else {
      const user = await User.findById(targetId).select('_id');
      if (!user) return res.status(404).json({ error: 'User not found' });
      ownerId = user._id;
    }

    if (ownerId && ownerId.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot report your own content' });
    }

    try {
      await Report.create({
        reporterId: req.user.userId,
        targetType,
        targetId,
        auctionId,
        reason,
        note
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ error: 'You already reported this. Our team will review it.' });
      }
      throw e;
    }

    await notifyAdmins({
      type: 'report',
      title: 'New report',
      message: `${targetType}: ${reason}`,
      link: '/admin/inbox'
    });

    res.status(201).json({ message: 'Thanks. Our team will review your report.' });
  } catch (err) {
    console.error('POST /support/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Admin only ----------

router.use('/admin', auth, admin);

// What was reported, in a form the admin can read at a glance
const describeTarget = async (report) => {
  try {
    if (report.targetType === 'auction') {
      const a = await Auction.findById(report.targetId).select('title status sellerId').populate('sellerId', 'fullName');
      if (!a) return { exists: false };
      return { exists: true, title: a.title, status: a.status, owner: a.sellerId ? a.sellerId.fullName : '', link: `/auctions/${a._id}` };
    }
    if (report.targetType === 'gig') {
      const g = await Gig.findById(report.targetId).select('title status sellerId').populate('sellerId', 'fullName');
      if (!g) return { exists: false };
      return { exists: true, title: g.title, status: g.status, owner: g.sellerId ? g.sellerId.fullName : '', link: `/clear-space/${g._id}` };
    }
    if (report.targetType === 'comment') {
      const c = await Comment.findById(report.targetId).select('content auctionId userId').populate('userId', 'fullName');
      if (!c) return { exists: false };
      return { exists: true, title: c.content, status: '', owner: c.userId ? c.userId.fullName : '', link: `/auctions/${c.auctionId}` };
    }
    const u = await User.findById(report.targetId).select('fullName isBanned');
    if (!u) return { exists: false };
    return { exists: true, title: u.fullName, status: u.isBanned ? 'banned' : 'active', owner: '', link: `/users/${u._id}` };
  } catch (err) {
    return { exists: false };
  }
};

// LIST REPORTS (?status=open or all)
router.get('/admin/reports', async (req, res) => {
  try {
    const filter = req.query.status === 'all' ? {} : { status: 'open' };
    const reports = await Report.find(filter)
      .populate('reporterId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(100);

    const result = await Promise.all(
      reports.map(async (r) => ({ ...r.toObject(), target: await describeTarget(r) }))
    );

    res.json(result);
  } catch (err) {
    console.error('GET /support/admin/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DECIDE A REPORT
router.patch('/admin/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id) || !['open', 'actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const wasOpen = report.status === 'open';
    report.status = status;
    await report.save();

    if (wasOpen && status !== 'open') {
      await notify(report.reporterId, {
        type: 'info',
        title: 'We reviewed your report',
        message:
          status === 'actioned'
            ? 'We took action. Thank you for helping keep TradeSpace safe.'
            : 'We reviewed it and found nothing against our rules. Thank you for telling us.',
        link: '/help'
      });
    }

    res.json({ _id: report._id, status: report.status });
  } catch (err) {
    console.error('PATCH /support/admin/reports/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE A REPORTED COMMENT
router.delete('/admin/comments/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid comment' });
    }
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    res.json({ message: 'Comment removed' });
  } catch (err) {
    console.error('DELETE /support/admin/comments/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LIST SUPPORT REQUESTS (?status=open or all)
router.get('/admin/tickets', async (req, res) => {
  try {
    const filter = req.query.status === 'all' ? {} : { status: 'open' };
    const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(tickets);
  } catch (err) {
    console.error('GET /support/admin/tickets error:', err);
    res.status(500).json({ error: err.message });
  }
});

// REPLY TO OR RESOLVE A SUPPORT REQUEST - a reply shows up for logged in users as a notification
router.patch('/admin/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ticket' });
    }

    const { status } = req.body;
    if (status !== undefined && !['open', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const note = typeof req.body.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 1000) : undefined;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const noteChanged = note !== undefined && note !== ticket.adminNote;

    if (status !== undefined) ticket.status = status;
    if (note !== undefined) ticket.adminNote = note;
    await ticket.save();

    if (ticket.userId && noteChanged && note) {
      await notify(ticket.userId, {
        type: 'info',
        title: 'Support replied to you',
        message: note.slice(0, 250),
        link: '/support'
      });
    }

    res.json({ _id: ticket._id, status: ticket.status, adminNote: ticket.adminNote });
  } catch (err) {
    console.error('PATCH /support/admin/tickets/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
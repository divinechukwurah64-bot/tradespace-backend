const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', default: null },
  content: { type: String, required: true, maxlength: 2000 },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Opening one conversation
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// The inbox list and the unread count in the navbar
messageSchema.index({ receiverId: 1, isRead: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
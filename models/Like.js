const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// One like per user per auction
likeSchema.index({ auctionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
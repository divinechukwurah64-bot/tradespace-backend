const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

commentSchema.index({ auctionId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
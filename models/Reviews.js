const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

// One review per buyer per sale
reviewSchema.index({ auctionId: 1, reviewerId: 1 }, { unique: true });
reviewSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
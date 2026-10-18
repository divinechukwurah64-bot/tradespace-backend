const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true, enum: ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Other'] },
  images: { type: [String], default: [] },
  condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'], default: 'Good' },
  startingBid: { type: Number, required: true },
  currentBid: { type: Number, default: null },
  buyItNowPrice: { type: Number, default: null },
  bids: [{
    bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  status: { type: String, enum: ['active', 'ended', 'sold'], default: 'active' },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  winningBid: { type: Number, default: null },
  shippingCost: { type: Number, default: 0 },
  location: { type: String, default: 'Nigeria' },
  updatedAt: { type: Date, default: Date.now }
});

auctionSchema.pre('save', function(next) {
  if (!this.endsAt) {
    const now = new Date();
    this.endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Auction', auctionSchema);
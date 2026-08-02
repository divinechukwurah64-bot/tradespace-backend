const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', default: null },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  platformCommissionPercent: { type: Number, default: 10 },
  platformCommission: { type: Number, default: 0 },
  sellerPayout: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'captured', 'held', 'released', 'refunded', 'failed'], default: 'pending' },
  paystackReference: { type: String, default: null },
  inspectionStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  inspectionPhotos: { type: [String], default: [] },
  inspectionNotes: { type: String, default: '' },
  disputeStatus: { type: String, enum: ['none', 'filed', 'resolved'], default: 'none' },
  disputeNotes: { type: String, default: '' },
  returnInitiatedAt: { type: Date, default: null },
  returnConfirmedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  capturedAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now }
});

transactionSchema.pre('save', function(next) {
  this.platformCommission = (this.amount * this.platformCommissionPercent) / 100;
  this.sellerPayout = this.amount - this.platformCommission;
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
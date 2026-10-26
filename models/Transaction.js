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
  disputeReason: { type: String, default: '' },
  disputeOpenedAt: { type: Date, default: null },
  disputeResolvedAt: { type: Date, default: null },
  returnInitiatedAt: { type: Date, default: null },
  returnConfirmedAt: { type: Date, default: null },
  autoReleaseAt: { type: Date, default: null },
  payoutStatus: { type: String, enum: ['none', 'queued', 'processing', 'paid', 'failed'], default: 'none' },
  payoutReference: { type: String, default: null },
  payoutTransferCode: { type: String, default: null },
  payoutAttempts: { type: Number, default: 0 },
  payoutNextAttemptAt: { type: Date, default: null },
  payoutStartedAt: { type: Date, default: null },
  payoutAt: { type: Date, default: null },
  payoutError: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  capturedAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now }
});

transactionSchema.pre('save', function(next) {
  this.platformCommission = Math.round(this.amount * this.platformCommissionPercent) / 100;
  this.sellerPayout = Math.round((this.amount - this.platformCommission) * 100) / 100;
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['auction', 'comment', 'user', 'gig'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  reason: { type: String, required: true },
  note: { type: String, default: '', maxlength: 500 },
  status: { type: String, enum: ['open', 'actioned', 'dismissed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

// One report per person per thing, so nobody can flood the inbox
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
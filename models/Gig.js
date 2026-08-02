const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['Web Design', 'Writing', 'Graphics', 'Video', 'Music', 'Programming', 'Marketing', 'Other']
  },
  startingPrice: { type: Number, required: true },
  deliveryDays: { type: Number, default: 3 },
  rating: { type: Number, default: 5, min: 0, max: 5 },
  orders: { type: Number, default: 0 },
  tags: [String],
  images: [String],
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  reviews: [
    {
      buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: Number,
      comment: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gig', gigSchema);
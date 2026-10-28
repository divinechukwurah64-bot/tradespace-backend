const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 200, lowercase: true },
  topic: { type: String, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  link: { type: String, default: '', maxlength: 300 },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  adminNote: { type: String, default: '', maxlength: 1000 },
  createdAt: { type: Date, default: Date.now }
});

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
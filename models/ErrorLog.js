const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  reference: { type: String, index: true },
  message: { type: String },
  stack: { type: String, default: null },
  method: { type: String, default: null },
  path: { type: String, default: null },
  statusCode: { type: Number, default: null },
  userId: { type: String, default: null },
  ip: { type: String, default: null },
  source: { type: String, default: 'api' },
  createdAt: { type: Date, default: Date.now, expires: '30d' }
});

module.exports = mongoose.model('ErrorLog', errorLogSchema);
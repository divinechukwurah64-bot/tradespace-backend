const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String },
  profileImage: { type: String, default: null },
  bio: { type: String, default: '' },
  sellerRating: { type: Number, default: 5, min: 0, max: 5 },
  totalSalesCount: { type: Number, default: 0 },
  totalBidsCount: { type: Number, default: 0 },
  stars: { type: Number, default: 5 },
  bankAccountName: { type: String, default: null },
  bankAccountNumber: { type: String, default: null },
  bankCode: { type: String, default: null },
  isVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  acceptedTermsAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
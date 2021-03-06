var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  fullName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  from: { type: Array, required: true },
  to: { type: Array, required: true },
  sortBy: { type: String, required: true },
  searchTrips: { type: Boolean, default: false },
  savedResult: { type: Array },
  addressHistory: { type: Array },
  maximumTime: { type: String },
}, { _id: false, versionKey: false });

module.exports = mongoose.model('User', userSchema, 'User');
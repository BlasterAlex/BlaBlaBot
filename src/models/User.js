var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  fullName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  from: { type: Array, required: true },
  to: { type: Array, required: true },
}, { _id: false, versionKey: false });

module.exports = mongoose.model('User', userSchema, 'User');
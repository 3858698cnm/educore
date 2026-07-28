const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  className: { type: String, required: true },
  unitId: { type: String },
  lecturerId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, default: 'active' },
  totalChecks: { type: Number, default: 0 }
});

module.exports = mongoose.model('Session', sessionSchema);
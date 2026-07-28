const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  courseId: { type: String, required: true },
  lecturerId: { type: String },
  attendanceWeight: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Unit', unitSchema);
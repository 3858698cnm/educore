const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  sessionId: { type: String, required: true },
  unitId: { type: String },
  responses: { type: Number, default: 0 },
  checksSent: { type: Number, default: 0 },
  finalStatus: { type: String, default: 'present' },
  attendancePercent: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
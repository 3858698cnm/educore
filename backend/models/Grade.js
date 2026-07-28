const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  unitId: { type: String, required: true },
  examScore: { type: Number, default: 0 },
  attendanceScore: { type: Number, default: 0 },
  catScore: { type: Number, default: 0 },
  finalScore: { type: Number, default: 0 },
  letterGrade: { type: String, default: '' }
});

module.exports = mongoose.model('Grade', gradeSchema);
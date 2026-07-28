const mongoose = require('mongoose');

const catResultSchema = new mongoose.Schema({
  catId: { type: String, required: true },
  studentId: { type: String, required: true },
  unitId: { type: String },
  correctCount: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  scoreOutOf30: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CatResult', catResultSchema);
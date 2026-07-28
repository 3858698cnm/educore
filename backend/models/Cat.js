const mongoose = require('mongoose');

const catSchema = new mongoose.Schema({
  title: { type: String, required: true },
  unitId: { type: String, required: true },
  lecturerId: { type: String, required: true },
  timeLimitMinutes: { type: Number, required: true },
  questions: [{
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswerIndex: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cat', catSchema);
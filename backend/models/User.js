const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'lecturer', 'student'], default: 'student' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  facultyId: { type: String },
  departmentId: { type: String },
  courseId: { type: String },
  profileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
  admissionNumber: { type: String, unique: true, sparse: true }
});

module.exports = mongoose.model('User', userSchema);
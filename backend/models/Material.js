const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String },
  unitId: { type: String },
  uploadedBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Material', materialSchema);
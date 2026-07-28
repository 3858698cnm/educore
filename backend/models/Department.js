const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  facultyId: { type: String, required: true }
});

module.exports = mongoose.model('Department', departmentSchema);
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Unit = require('../models/Unit');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

router.get('/api/units', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find();
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/api/units/course/:courseId', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find({ courseId: req.params.courseId });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Units assigned to a specific lecturer
router.get('/api/my-units', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find({ lecturerId: req.user.id });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/api/units', authMiddleware, async (req, res) => {
  try {
    const { name, code, courseId, lecturerId, attendanceWeight } = req.body;
    const existing = await Unit.findOne({ code });
    if (existing) {
      return res.status(400).json({ message: 'Unit code already exists' });
    }
    const newUnit = new Unit({ name, code, courseId, lecturerId, attendanceWeight });
    await newUnit.save();
    res.status(201).json(newUnit);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/api/units/:id', authMiddleware, async (req, res) => {
  try {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Units for student's course
router.get('/api/student-units', authMiddleware, async (req, res) => {
  const User = require('../models/User');
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json([]);
    }
    const units = await Unit.find({ courseId: student.courseId });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Grade = require('../models/Grade');
const Unit = require('../models/Unit');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const CatResult = require('../models/CatResult');

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

// Get students enrolled in a unit's course + attendance + grades + CAT results
router.get('/api/unit-students/:unitId', authMiddleware, async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.unitId);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });

    const students = await User.find({
      role: 'student',
      status: 'approved',
      courseId: unit.courseId
    }).select('-password');

    const attendance = await Attendance.find({ unitId: req.params.unitId });
    const grades = await Grade.find({ unitId: req.params.unitId });
    const catResults = await CatResult.find({ unitId: req.params.unitId });

    res.json({ students, attendance, grades, catResults });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Save or update a grade
router.post('/api/grades', authMiddleware, async (req, res) => {
  try {
    const { studentId, unitId, examScore, attendanceScore, catScore, finalScore, letterGrade } = req.body;

    const existing = await Grade.findOne({ studentId, unitId });

    if (existing) {
      await Grade.findByIdAndUpdate(existing._id, {
        examScore,
        attendanceScore,
        catScore,
        finalScore,
        letterGrade
      });
    } else {
      const newGrade = new Grade({
        studentId,
        unitId,
        examScore,
        attendanceScore,
        catScore,
        finalScore,
        letterGrade
      });
      await newGrade.save();
    }

    res.json({ message: 'Grade saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Student's own grades (simple)
router.get('/api/my-grades', authMiddleware, async (req, res) => {
  try {
    const grades = await Grade.find({ studentId: req.user.id });
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Student's full grades breakdown (with attendance + CAT + exam)
router.get('/api/my-grades-full', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json({ results: [] });
    }

    const units = await Unit.find({ courseId: student.courseId });

    const results = await Promise.all(units.map(async (unit) => {
      const grade = await Grade.findOne({
        studentId: req.user.id,
        unitId: unit._id
      });

      const attendance = await Attendance.findOne({
        studentId: req.user.id,
        unitId: unit._id
      });

      const catResults = await CatResult.find({
        studentId: req.user.id,
        unitId: unit._id
      });

      let catScore = 0;
      if (catResults.length > 0) {
        const total = catResults.reduce((sum, c) => sum + c.scoreOutOf30, 0);
        catScore = parseFloat((total / catResults.length).toFixed(1));
      }

      return { unit, grade, attendance, catScore };
    }));

    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
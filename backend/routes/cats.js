const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Cat = require('../models/Cat');
const CatResult = require('../models/CatResult');
const Unit = require('../models/Unit');
const User = require('../models/User');

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

// Create a new CAT
router.post('/api/cats', authMiddleware, async (req, res) => {
  try {
    const { title, unitId, timeLimitMinutes, questions } = req.body;

    if (!title || !unitId || !timeLimitMinutes || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Please fill in all fields and add at least one question' });
    }

    const newCat = new Cat({
      title,
      unitId,
      lecturerId: req.user.id,
      timeLimitMinutes,
      questions
    });
    await newCat.save();
    res.status(201).json(newCat);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all CATs created by this lecturer
router.get('/api/my-cats', authMiddleware, async (req, res) => {
  try {
    const cats = await Cat.find({ lecturerId: req.user.id });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete a CAT
router.delete('/api/cats/:id', authMiddleware, async (req, res) => {
  try {
    await Cat.findByIdAndDelete(req.params.id);
    res.json({ message: 'CAT deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get available CATs for student
router.get('/api/my-course-cats', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json({ cats: [], units: [] });
    }

    const units = await Unit.find({ courseId: student.courseId });
    const unitIds = units.map(u => u._id.toString());

    const cats = await Cat.find({ unitId: { $in: unitIds } }).sort({ createdAt: -1 });

    const safeCats = cats.map(cat => ({
      _id: cat._id,
      title: cat.title,
      unitId: cat.unitId,
      timeLimitMinutes: cat.timeLimitMinutes,
      totalQuestions: cat.questions.length
    }));

    res.json({ cats: safeCats, units });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get one CAT's full questions to take it
router.get('/api/cats/:id/take', authMiddleware, async (req, res) => {
  try {
    const cat = await Cat.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'CAT not found' });

    const alreadyDone = await CatResult.findOne({ catId: req.params.id, studentId: req.user.id });
    if (alreadyDone) {
      return res.status(400).json({ message: 'You have already attempted this CAT' });
    }

    const questionsForStudent = cat.questions.map(q => ({
      questionText: q.questionText,
      options: q.options
    }));

    res.json({
      _id: cat._id,
      title: cat.title,
      timeLimitMinutes: cat.timeLimitMinutes,
      questions: questionsForStudent
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Submit CAT answers and get auto-graded
router.post('/api/cats/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { answers, unitId } = req.body;

    const alreadyDone = await CatResult.findOne({ catId: req.params.id, studentId: req.user.id });
    if (alreadyDone) {
      return res.status(400).json({ message: 'You have already attempted this CAT' });
    }

    const cat = await Cat.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'CAT not found' });

    let correctCount = 0;
    cat.questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const scoreOutOf30 = Math.round((correctCount / cat.questions.length) * 30);

    const result = new CatResult({
      catId: cat._id,
      studentId: req.user.id,
      unitId: unitId || cat.unitId,
      correctCount,
      totalQuestions: cat.questions.length,
      scoreOutOf30
    });
    await result.save();

    res.json({ correctCount, totalQuestions: cat.questions.length, scoreOutOf30 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
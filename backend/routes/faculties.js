const express = require('express');
const router = express.Router();
const Faculty = require('../models/Faculty');

function authMiddleware(req, res, next) {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// GET all faculties
router.get('/api/faculties', authMiddleware, async (req, res) => {
  try {
    const faculties = await Faculty.find();
    res.json(faculties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUBLIC faculties (no login needed)
router.get('/api/public/faculties', async (req, res) => {
  try {
    const faculties = await Faculty.find();
    res.json(faculties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD a faculty
router.post('/api/faculties', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const newFaculty = new Faculty({ name });
    await newFaculty.save();
    res.status(201).json(newFaculty);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE a faculty
router.delete('/api/faculties/:id', authMiddleware, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
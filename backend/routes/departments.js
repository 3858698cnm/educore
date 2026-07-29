const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Department = require('../models/Department');

function authMiddleware(req, res, next) {
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

// GET all departments (optionally filtered by facultyId)
router.get('/api/departments', authMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.facultyId) {
      filter.facultyId = req.query.facultyId;
    }
    const departments = await Department.find(filter);
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUBLIC departments by faculty (no login required)
router.get('/api/public/departments/:facultyId', async (req, res) => {
  try {
    const departments = await Department.find({ facultyId: req.params.facultyId });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE a department
router.delete('/api/departments/:id', authMiddleware, async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
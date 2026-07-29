const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Course = require('../models/Course');
const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const Unit = require('../models/Unit');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendEmail(to, subject, html) {
  try {
    await brevoApi.sendTransacEmail({
      sender: { name: 'EduCore', email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html
    });
    console.log('Email sent to', to);
  } catch (err) {
    console.log('Email error:', err.message);
  }
}

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

// GET all pending users
router.get('/api/admin/pending', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// APPROVE OR REJECT a user
router.post('/api/admin/approve', authMiddleware, async (req, res) => {
  try {
    const { userId, status } = req.body;
    const user = await User.findByIdAndUpdate(userId, { status });

    if (user) {
      if (status === 'approved') {
        await sendEmail(
          user.email,
          'EduCore - Account Approved!',
          `<h2>Hi ${user.name},</h2>
           <p>Great news! Your EduCore account has been <b>approved</b>.</p>
           <p>You can now log in and start using the platform.</p>
           <p>— The EduCore Team</p>`
        );
      } else if (status === 'rejected') {
        await sendEmail(
          user.email,
          'EduCore - Registration Update',
          `<h2>Hi ${user.name},</h2>
           <p>We're sorry to inform you that your EduCore registration was not approved.</p>
           <p>If you believe this is a mistake, please contact your administrator.</p>
           <p>— The EduCore Team</p>`
        );
      }
    }

    res.json({ message: `User ${status} successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADMIN STATS
router.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student', status: 'approved' });
    const totalLecturers = await User.countDocuments({ role: 'lecturer', status: 'approved' });
    const totalCourses = await Course.countDocuments();
    const totalDepartments = await Department.countDocuments();
    const totalFaculties = await Faculty.countDocuments();
    const totalUnits = await Unit.countDocuments();
    const totalPending = await User.countDocuments({ status: 'pending' });

    res.json({
      totalStudents,
      totalLecturers,
      totalCourses,
      totalDepartments,
      totalFaculties,
      totalUnits,
      totalPending
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Lecturers dropdown
router.get('/api/lecturers', authMiddleware, async (req, res) => {
  try {
    const lecturers = await User.find({ role: 'lecturer' }).select('-password');
    res.json(lecturers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Students list
router.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete user
router.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin attendance records
router.get('/api/admin/attendance', authMiddleware, async (req, res) => {
  try {
    const filter = { status: 'ended' };
    const attendanceFilter = {};

    if (req.query.unitId) {
      filter.unitId = req.query.unitId;
      attendanceFilter.unitId = req.query.unitId;
    }

    if (req.query.status) {
      attendanceFilter.finalStatus = req.query.status;
    }

    const sessions = await Session.find(filter).sort({ startTime: -1 });
    const attendance = await Attendance.find(attendanceFilter);

    res.json({ sessions, attendance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
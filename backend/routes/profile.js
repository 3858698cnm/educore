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

// Complete profile (student or lecturer choosing faculty/department/course)
router.post('/api/complete-profile', authMiddleware, async (req, res) => {
  try {
    const { facultyId, departmentId, courseId } = req.body;

    const updateData = {
      facultyId,
      departmentId,
      profileComplete: true
    };

    if (courseId) {
      updateData.courseId = courseId;
    }

    const user = await User.findById(req.user.id);
    let admissionNumber = null;

    if (user.role === 'student' && courseId) {
      const course = await Course.findById(courseId);

      if (course && course.code) {
        const year = new Date().getFullYear();

        const countInCourse = await User.countDocuments({
          role: 'student',
          courseId: courseId,
          admissionNumber: { $exists: true, $ne: null }
        });

        const sequence = String(countInCourse + 1).padStart(3, '0');
        admissionNumber = `${course.code}/${sequence}/${year}`;
        updateData.admissionNumber = admissionNumber;
      }
    }

    await User.findByIdAndUpdate(req.user.id, updateData);

    res.json({
      message: 'Profile completed successfully',
      admissionNumber
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Student profile
router.get('/api/my-profile', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('-password');

    if (!student.courseId) {
      return res.json({ course: null, units: [], faculty: null, department: null });
    }

    const course = await Course.findById(student.courseId);
    const department = await Department.findById(student.departmentId);
    const faculty = await Faculty.findById(student.facultyId);
    const units = await Unit.find({ courseId: student.courseId });

    const unitsWithLecturers = await Promise.all(units.map(async (unit) => {
      const lecturer = unit.lecturerId
        ? await User.findById(unit.lecturerId).select('name')
        : null;
      return {
        _id: unit._id,
        name: unit.name,
        code: unit.code,
        lecturerName: lecturer ? lecturer.name : null
      };
    }));

    res.json({
      student,
      course,
      department,
      faculty,
      units: unitsWithLecturers
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Lecturer profile
router.get('/api/lecturer-profile', authMiddleware, async (req, res) => {
  try {
    const lecturer = await User.findById(req.user.id).select('-password');
    const department = lecturer.departmentId
      ? await Department.findById(lecturer.departmentId)
      : null;
    const faculty = lecturer.facultyId
      ? await Faculty.findById(lecturer.facultyId)
      : null;

    const units = await Unit.find({ lecturerId: req.user.id });

    const unitsWithCourse = await Promise.all(units.map(async (unit) => {
      const course = unit.courseId
        ? await Course.findById(unit.courseId)
        : null;
      return {
        _id: unit._id,
        name: unit.name,
        code: unit.code,
        courseName: course ? course.name : null
      };
    }));

    res.json({ lecturer, department, faculty, units: unitsWithCourse });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Lecturer active session
router.get('/api/my-active-session', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findOne({
      lecturerId: req.user.id,
      status: 'active'
    });
    res.json({ session: session || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Active sessions for student's course
router.get('/api/active-sessions', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student.courseId) {
      return res.json([]);
    }

    const units = await Unit.find({ courseId: student.courseId });
    const unitIds = units.map(u => u._id.toString());

    const sessions = await Session.find({
      status: 'active',
      unitId: { $in: unitIds }
    });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Public active sessions (no login)
router.get('/api/public/active-sessions', async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'active' });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Lecturer student count
router.get('/api/my-students-count', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find({ lecturerId: req.user.id });
    const courseIds = [...new Set(units.map(u => u.courseId))];

    const count = await User.countDocuments({
      role: 'student',
      status: 'approved',
      courseId: { $in: courseIds }
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Lecturer past sessions
router.get('/api/my-sessions-full', authMiddleware, async (req, res) => {
  try {
    const filter = {
      lecturerId: req.user.id,
      status: 'ended'
    };

    if (req.query.unitId) {
      filter.unitId = req.query.unitId;
    }

    const sessions = await Session.find(filter).sort({ startTime: -1 });

    const sessionIds = sessions.map(s => s._id.toString());
    const attendance = await Attendance.find({
      sessionId: { $in: sessionIds }
    });

    res.json({ sessions, attendance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Student's own attendance history
router.get('/api/my-attendance', authMiddleware, async (req, res) => {
  try {
    const filter = { studentId: req.user.id };

    if (req.query.unitId) {
      filter.unitId = req.query.unitId;
    }

    if (req.query.status) {
      filter.finalStatus = req.query.status;
    }

    const attendance = await Attendance.find(filter).sort({ _id: -1 });

    const sessionIds = attendance.map(a => a.sessionId);
    const sessions = await Session.find({ _id: { $in: sessionIds } });

    res.json({ sessions, attendance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
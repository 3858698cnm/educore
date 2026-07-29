const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(require('./routes/faculties'));
app.use(require('./routes/departments'));
app.use(require('./routes/courses'));
app.use(require('./routes/units'));
app.use(require('./routes/materials'));
app.use(require('./routes/cats'));
app.use(require('./routes/grades'));
app.use(require('./routes/auth'));
app.use(require('./routes/admin'));
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    // Clean up any leftover "active" sessions from before server restart
    await Session.updateMany({ status: 'active' }, { status: 'ended', endTime: new Date() });
    console.log('Cleaned up old active sessions');
  })
  .catch((err) => console.log('MongoDB error:', err));

const User = require('./models/User');
const Faculty = require('./models/Faculty');
const Department = require('./models/Department');
const Course = require('./models/Course');
const Unit = require('./models/Unit');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');
const Material = require('./models/Material');
const Grade = require('./models/Grade');
const Cat = require('./models/Cat');
const CatResult = require('./models/CatResult');

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

/* =====================
   GET ACTIVE SESSIONS ROUTE
===================== */
app.get('/api/active-sessions', async (req, res) => {
  try {
    const sessions = await Session.find({ status: 'active' });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/complete-profile', authMiddleware, async (req, res) => {
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

    // Generate admission number for students only
    const user = await User.findById(req.user.id);
    let admissionNumber = null;

    if (user.role === 'student' && courseId) {
      const course = await Course.findById(courseId);

      if (course && course.code) {
        const year = new Date().getFullYear();

        // Count existing students in this course to get the next sequence number
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
/* =====================
   STUDENT PROFILE ROUTE
===================== */
app.get('/api/my-profile', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('-password');

    if (!student.courseId) {
      return res.json({ course: null, units: [], faculty: null, department: null });
    }

    const course = await Course.findById(student.courseId);
    const department = await Department.findById(student.departmentId);
    const faculty = await Faculty.findById(student.facultyId);
    const units = await Unit.find({ courseId: student.courseId });

    // Get lecturer names for each unit
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

/* =====================
   LECTURER PROFILE ROUTE
===================== */
app.get('/api/lecturer-profile', authMiddleware, async (req, res) => {
  try {
    const lecturer = await User.findById(req.user.id).select('-password');
    const department = lecturer.departmentId
      ? await Department.findById(lecturer.departmentId)
      : null;
    const faculty = lecturer.facultyId
      ? await Faculty.findById(lecturer.facultyId)
      : null;

    // Get units assigned to this lecturer
    const units = await Unit.find({ lecturerId: req.user.id });

    // Get course name for each unit
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

/* =====================
   LECTURER ACTIVE SESSION
===================== */
app.get('/api/my-active-session', authMiddleware, async (req, res) => {
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

/* =====================
   LECTURER SESSIONS HISTORY
===================== */
app.get('/api/active-sessions', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);

    if (!student.courseId) {
      return res.json([]);
    }

    // Get all units for student's course
    const units = await Unit.find({ courseId: student.courseId });
    const unitIds = units.map(u => u._id.toString());

    // Only return active sessions for those units
    const sessions = await Session.find({
      status: 'active',
      unitId: { $in: unitIds }
    });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   LECTURER STUDENT COUNT
===================== */
app.get('/api/my-students-count', authMiddleware, async (req, res) => {
  try {
    // Get all units assigned to this lecturer
    const units = await Unit.find({ lecturerId: req.user.id });
    const courseIds = [...new Set(units.map(u => u.courseId))];

    // Count students enrolled in those courses
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

/* =====================
   LECTURER PAST SESSIONS
===================== */
app.get('/api/my-sessions-full', authMiddleware, async (req, res) => {
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
/* =====================
   STUDENT MY ATTENDANCE
===================== */
app.get('/api/my-attendance', authMiddleware, async (req, res) => {
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
/* =====================
   SOCKET.IO LIVE CLASS LOGIC
===================== */

// Keep track of active sessions in memory while server is running
let activeSessions = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // LECTURER STARTS A CLASS
 socket.on('lecturer-start-class', async (data) => {
    const { className, lecturerId, lecturerName, unitId, unitName } = data;

    const newSession = new Session({
      className,
      lecturerId,
      unitId,
      status: 'active'
    });
    await newSession.save();

    const sessionId = newSession._id.toString();

activeSessions[sessionId] = {
      className,
      lecturerId,
      unitId: unitId || null,
      lecturerSocketId: socket.id,
      students: {}
    };

    socket.join(sessionId);

    socket.emit('class-started', {
      sessionId,
      className
    });

    console.log('Class started:', className, sessionId);
  });

  // STUDENT JOINS A CLASS
 socket.on('student-join-class', async (data) => {
    const { sessionId, studentId, studentName } = data;

    if (!activeSessions[sessionId]) {
      socket.emit('join-error', { message: 'Class not found or has ended' });
      return;
    }

    // Check if this session's unit belongs to student's course
    const session = activeSessions[sessionId];
    if (session.unitId) {
      const unit = await Unit.findById(session.unitId);
      if (unit) {
        const student = await User.findById(studentId);
        if (student && student.courseId &&
            unit.courseId.toString() !== student.courseId.toString()) {
          socket.emit('join-error', {
            message: 'This class is not for your enrolled course'
          });
          return;
        }
      }
    }

    activeSessions[sessionId].students[studentId] = {
      socketId: socket.id,
      name: studentName,
      checksSent: 0,
      responses: 0
    };

    socket.join(sessionId);

    // Tell the lecturer a student joined
  io.to(activeSessions[sessionId].lecturerSocketId).emit('student-joined', {
      studentId,
      studentName,
      studentSocketId: socket.id
    });
    socket.emit('joined-success', {
      className: activeSessions[sessionId].className
    });
  });

  // LECTURER SENDS ATTENTION CHECK
  socket.on('send-attention-check', (data) => {
    const { sessionId } = data;

    if (!activeSessions[sessionId]) return;

    // Increase checksSent for all students in this session
    for (let studentId in activeSessions[sessionId].students) {
      activeSessions[sessionId].students[studentId].checksSent++;
    }

    // Send the popup event to all students in this session room
    socket.to(sessionId).emit('attention-check');
  });

  // STUDENT RESPONDS TO ATTENTION CHECK
  socket.on('student-respond-check', (data) => {
    const { sessionId, studentId } = data;

    if (!activeSessions[sessionId]) return;
    if (!activeSessions[sessionId].students[studentId]) return;

    activeSessions[sessionId].students[studentId].responses++;

    // Tell the lecturer this student responded
    io.to(activeSessions[sessionId].lecturerSocketId).emit('student-responded', {
      studentId
    });
  });

  // LECTURER ENDS CLASS
  socket.on('lecturer-end-class', async (data) => {
    const { sessionId, unitId } = data;

    if (!activeSessions[sessionId]) return;

    try {
      const session = activeSessions[sessionId];
      const results = [];

      for (let studentId in session.students) {
        const s = session.students[studentId];

        let finalStatus = 'present';
        let attendancePercent = 100;

        if (s.checksSent === 0) {
          finalStatus = 'present';
          attendancePercent = 100;
        } else if (s.responses === 0) {
          finalStatus = 'absent';
          attendancePercent = 0;
        } else if (s.responses < s.checksSent) {
          finalStatus = 'partial';
          attendancePercent = Math.round((s.responses / s.checksSent) * 100);
        } else {
          finalStatus = 'present';
          attendancePercent = 100;
        }

        // Save attendance record to MongoDB
        const attendanceRecord = new Attendance({
          studentId,
          studentName: s.name,
          sessionId,
          unitId: unitId || null,
          responses: s.responses,
          checksSent: s.checksSent,
          finalStatus,
          attendancePercent
        });
        await attendanceRecord.save();

        results.push({
          studentId,
          studentName: s.name,
          finalStatus,
          attendancePercent: Math.round(attendancePercent)
        });

        // Tell each student the class has ended
        io.to(s.socketId).emit('class-ended');
      }

      // Update session status in MongoDB
      await Session.findByIdAndUpdate(sessionId, {
        status: 'ended',
        endTime: new Date()
      });

      // Send final summary back to lecturer
      socket.emit('class-ended-summary', { results });

      // Clean up
      delete activeSessions[sessionId];

      console.log('Class ended:', sessionId);
    } catch (err) {
      console.error('Error ending class:', sessionId, err);
      socket.emit('class-ended-summary', { results: [] });
      delete activeSessions[sessionId];
    }
  });
// LECTURER STARTED MEDIA (camera or screen)
// LECTURER REJOINS AN EXISTING CLASS
  socket.on('lecturer-rejoin-class', async (data) => {
    const { sessionId, lecturerId, lecturerName } = data;

    // Rejoin the socket room
    socket.join(sessionId);

    // Update the active session with new socket ID
    if (activeSessions[sessionId]) {
      activeSessions[sessionId].lecturerSocketId = socket.id;
    } else {
      // Rebuild from database if server was restarted
      const session = await Session.findById(sessionId);
      if (session) {
        activeSessions[sessionId] = {
          className: session.className,
          lecturerId: session.lecturerId,
          unitId: session.unitId,
          lecturerSocketId: socket.id,
          students: {}
        };
      }
    }

    socket.emit('class-started', {
      sessionId,
      className: activeSessions[sessionId]
        ? activeSessions[sessionId].className
        : 'Live Class'
    });

    console.log('Lecturer rejoined class:', sessionId);
  });
  socket.on('lecturer-media-started', (data) => {
    const { sessionId, type } = data;
    socket.to(sessionId).emit('lecturer-media-started', { type });
  });

 // LECTURER STOPPED MEDIA
  socket.on('lecturer-media-stopped', (data) => {
    const { sessionId } = data;
    socket.to(sessionId).emit('lecturer-media-stopped');
  });
  socket.on('lecturer-video-stopped', (data) => {
    const { sessionId } = data;
    socket.to(sessionId).emit('lecturer-video-stopped');
  });

  // WEBRTC SIGNALING
  socket.on('webrtc-offer', (data) => {
    const { targetSocketId, offer, sessionId } = data;
    io.to(targetSocketId).emit('webrtc-offer', {
      offer,
      fromSocketId: socket.id,
      sessionId
    });
  });

  socket.on('webrtc-answer', (data) => {
    const { targetSocketId, answer } = data;
    io.to(targetSocketId).emit('webrtc-answer', {
      answer,
      fromSocketId: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const { targetSocketId, candidate } = data;
    io.to(targetSocketId).emit('webrtc-ice-candidate', {
      candidate,
      fromSocketId: socket.id
    });
  });

  socket.on('student-ready-for-stream', (data) => {
    const { sessionId } = data;
    if (activeSessions[sessionId]) {
      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-ready-for-stream', {
        studentSocketId: socket.id
      });
    }
  });
  // STUDENT CAMERA STARTED
  socket.on('student-camera-started', (data) => {
    const { sessionId, studentId, studentName } = data;
    if (activeSessions[sessionId]) {
      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-camera-started', {
        studentId,
        studentName
      });
    }
  });

  // STUDENT CAMERA STOPPED
  socket.on('student-camera-stopped', (data) => {
    const { sessionId, studentId } = data;
    if (activeSessions[sessionId]) {
      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-camera-stopped', {
        studentId
      });
    }
  });

  // STUDENT SENDS CAMERA OFFER TO LECTURER
  socket.on('student-webrtc-offer', (data) => {
    const { sessionId, studentId, studentName, offer } = data;
    if (activeSessions[sessionId]) {
      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-webrtc-offer', {
        studentId,
        studentName,
        offer,
        fromSocketId: socket.id
      });
    }
  });

  // LECTURER SENDS ANSWER TO STUDENT CAMERA
  socket.on('lecturer-student-answer', (data) => {
    const { sessionId, studentId, answer } = data;
    if (activeSessions[sessionId]) {
      const student = activeSessions[sessionId].students[studentId];
      if (student) {
        io.to(student.socketId).emit('student-webrtc-answer', { answer });
      }
    }
  });

  // ICE CANDIDATES FOR STUDENT CAMERA
  socket.on('student-webrtc-ice-candidate', (data) => {
    const { sessionId, studentId, candidate } = data;
    if (activeSessions[sessionId]) {
      io.to(activeSessions[sessionId].lecturerSocketId).emit('student-webrtc-ice-candidate', {
        studentId,
        candidate
      });
    }
  });

  socket.on('lecturer-student-ice-candidate', (data) => {
    const { sessionId, studentId, candidate } = data;
    if (activeSessions[sessionId]) {
      const student = activeSessions[sessionId].students[studentId];
      if (student) {
        io.to(student.socketId).emit('student-webrtc-ice-candidate', { candidate });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('EduCore server running on port ' + PORT);
});

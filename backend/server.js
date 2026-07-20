const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
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
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    // Clean up any leftover "active" sessions from before server restart
    await Session.updateMany({ status: 'active' }, { status: 'ended', endTime: new Date() });
    console.log('Cleaned up old active sessions');
  })
  .catch((err) => console.log('MongoDB error:', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'lecturer', 'student'], default: 'student' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  facultyId: { type: String },
  departmentId: { type: String },
  courseId: { type: String },
  profileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
 resetCode: { type: String },
  resetCodeExpires: { type: Date },
   admissionNumber: { type: String, unique: true, sparse: true }
});
const User = mongoose.model('User', userSchema);

const facultySchema = new mongoose.Schema({
  name: { type: String, required: true }
});
const Faculty = mongoose.model('Faculty', facultySchema);

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  facultyId: { type: String, required: true }
});
const Department = mongoose.model('Department', departmentSchema);

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  departmentId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Course = mongoose.model('Course', courseSchema);

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  courseId: { type: String, required: true },
  lecturerId: { type: String },
  attendanceWeight: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
});
const Unit = mongoose.model('Unit', unitSchema);

const sessionSchema = new mongoose.Schema({
  className: { type: String, required: true },
  unitId: { type: String },
  lecturerId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, default: 'active' },
  totalChecks: { type: Number, default: 0 }
});
const Session = mongoose.model('Session', sessionSchema);

const attendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  sessionId: { type: String, required: true },
  unitId: { type: String },
  responses: { type: Number, default: 0 },
  checksSent: { type: Number, default: 0 },
  finalStatus: { type: String, default: 'present' },
  attendancePercent: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

const materialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String },
  unitId: { type: String },
  uploadedBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Material = mongoose.model('Material', materialSchema);

const gradeSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  unitId: { type: String, required: true },
  examScore: { type: Number, default: 0 },
  attendanceScore: { type: Number, default: 0 },
  finalScore: { type: Number, default: 0 },
  letterGrade: { type: String, default: '' }
});
const Grade = mongoose.model('Grade', gradeSchema);

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

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be self-registered' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      status: 'pending'
    });
await newUser.save();

    await sendEmail(
      email,
      'Welcome to EduCore - Registration Received',
      `<h2>Hi ${name},</h2>
       <p>Thank you for registering on EduCore as a <b>${role}</b>.</p>
       <p>Your account is currently pending admin approval. You'll be able to log in once approved.</p>
       <p>— The EduCore Team</p>`
    );

    res.status(201).json({ message: 'Account created! Please wait for admin approval before logging in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    let user;
    if (email.includes('/')) {
      // Admission number login
      user = await User.findOne({ admissionNumber: email.toUpperCase() });
      if (!user) return res.status(400).json({ message: 'Admission number not found' });
    } else {
      // Email login (admin/lecturer, or student who hasn't completed profile yet)
      user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Email not found' });

      if (user.role === 'student' && user.admissionNumber) {
        return res.status(400).json({
          message: 'Please log in with your admission number instead of your email'
        });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Wrong password' });

    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is awaiting admin approval' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your registration was not approved' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
      id: user._id,
      profileComplete: user.profileComplete || false
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   RESET PASSWORD ROUTE
===================== */
/* =====================
   REQUEST PASSWORD RESET CODE
===================== */
app.post('/api/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await User.findByIdAndUpdate(user._id, {
      resetCode: code,
      resetCodeExpires: expires
    });

    await sendEmail(
      email,
      'EduCore - Password Reset Code',
      `<h2>Hi ${user.name},</h2>
       <p>Your password reset code is:</p>
       <h1 style="letter-spacing: 4px;">${code}</h1>
       <p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
       <p>— The EduCore Team</p>`
    );

    res.json({ message: 'Reset code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/* =====================
   RESET PASSWORD WITH CODE
===================== */
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    if (!user.resetCode || user.resetCode !== code) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetCode: null,
      resetCodeExpires: null
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
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
/* =====================
   ADMIN APPROVAL ROUTES
===================== */

// GET all pending users
app.get('/api/admin/pending', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// APPROVE OR REJECT a user
app.post('/api/admin/approve', authMiddleware, async (req, res) => {
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
/* =====================
   ADMIN STATS ROUTE
===================== */
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
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
/* =====================
   FACULTY ROUTES
===================== */

// GET all faculties
app.get('/api/faculties', authMiddleware, async (req, res) => {
  try {
    const faculties = await Faculty.find();
    res.json(faculties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUBLIC faculties (no login needed - for profile completion page)
app.get('/api/public/faculties', async (req, res) => {
  try {
    const faculties = await Faculty.find();
    res.json(faculties);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD a faculty
app.post('/api/faculties', authMiddleware, async (req, res) => {
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
app.delete('/api/faculties/:id', authMiddleware, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   DEPARTMENT ROUTES
===================== */

// GET all departments
app.get('/api/departments', authMiddleware, async (req, res) => {
  try {
    let departments;
    if (req.query.facultyId) {
      departments = await Department.find({ facultyId: req.query.facultyId });
    } else {
      departments = await Department.find();
    }
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET departments by faculty (public - for cascading dropdowns)
app.get('/api/public/departments/:facultyId', async (req, res) => {
  try {
    const departments = await Department.find({ facultyId: req.params.facultyId });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD a department
app.get('/api/departments', authMiddleware, async (req, res) => {
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

// DELETE a department
app.delete('/api/departments/:id', authMiddleware, async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// PUBLIC departments by faculty (no login required)
app.get('/api/public/departments/:facultyId', async (req, res) => {
  try {
    const departments = await Department.find({ facultyId: req.params.facultyId });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUBLIC courses by department (no login required)
app.get('/api/public/courses/:departmentId', async (req, res) => {
  try {
    const courses = await Course.find({ departmentId: req.params.departmentId });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   LECTURERS ROUTE (for dropdowns)
===================== */
app.get('/api/lecturers', authMiddleware, async (req, res) => {
  try {
    const lecturers = await User.find({ role: 'lecturer' }).select('-password');
    res.json(lecturers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   STUDENT MY UNITS (units for student's course)
===================== */
app.get('/api/student-units', authMiddleware, async (req, res) => {
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
/* =====================
   COURSE ROUTES
===================== */

app.get('/api/courses', authMiddleware, async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/public/courses/:departmentId', async (req, res) => {
  try {
    const courses = await Course.find({ departmentId: req.params.departmentId });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/courses', authMiddleware, async (req, res) => {
  try {
    const { name, code, departmentId } = req.body;

    const existing = await Course.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    const newCourse = new Course({ name, code: code.toUpperCase(), departmentId });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.delete('/api/courses/:id', authMiddleware, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
app.put('/api/courses/:id', authMiddleware, async (req, res) => {
  try {
    const { name, code, departmentId } = req.body;

    if (code) {
      const existing = await Course.findOne({
        code: code.toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ message: 'Course code already exists' });
      }
    }

    const updated = await Course.findByIdAndUpdate(
      req.params.id,
      { name, code: code ? code.toUpperCase() : undefined, departmentId },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   UNIT ROUTES
===================== */

app.get('/api/units', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find();
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/api/units/course/:courseId', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find({ courseId: req.params.courseId });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Units assigned to a specific lecturer
app.get('/api/my-units', authMiddleware, async (req, res) => {
  try {
    const units = await Unit.find({ lecturerId: req.user.id });
    res.json(units);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/units', authMiddleware, async (req, res) => {
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

app.delete('/api/units/:id', authMiddleware, async (req, res) => {
  try {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   DELETE USER ROUTE (used for both students and lecturers)
===================== */
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
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
   STUDENT GRADES ROUTE
===================== */
app.get('/api/my-grades', authMiddleware, async (req, res) => {
  try {
    const grades = await Grade.find({ studentId: req.user.id });
    res.json(grades);
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
   GRADES ROUTES
===================== */

// Get students enrolled in a unit's course + their attendance + grades
app.get('/api/unit-students/:unitId', authMiddleware, async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.unitId);
    if (!unit) return res.status(404).json({ message: 'Unit not found' });

    // Get all students enrolled in this unit's course
    const students = await User.find({
      role: 'student',
      status: 'approved',
      courseId: unit.courseId
    }).select('-password');

    // Get attendance records for this unit
    const attendance = await Attendance.find({ unitId: req.params.unitId });

    // Get existing grades for this unit
    const grades = await Grade.find({ unitId: req.params.unitId });

    res.json({ students, attendance, grades });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Save or update a grade
app.post('/api/grades', authMiddleware, async (req, res) => {
  try {
    const { studentId, unitId, examScore, attendanceScore, finalScore, letterGrade } = req.body;

    // Check if grade already exists
    const existing = await Grade.findOne({ studentId, unitId });

    if (existing) {
      await Grade.findByIdAndUpdate(existing._id, {
        examScore,
        attendanceScore,
        finalScore,
        letterGrade
      });
    } else {
      const newGrade = new Grade({
        studentId,
        unitId,
        examScore,
        attendanceScore,
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
/* =====================
   MATERIALS ROUTES
===================== */

// Get all materials uploaded by this lecturer
app.get('/api/my-materials', authMiddleware, async (req, res) => {
  try {
    const materials = await Material.find({ uploadedBy: req.user.id });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get materials for a specific unit (for students)
app.get('/api/materials/unit/:unitId', authMiddleware, async (req, res) => {
  try {
    const materials = await Material.find({ unitId: req.params.unitId });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Upload a material
app.post('/api/materials', authMiddleware, async (req, res) => {
  try {
    const { unitId, title, link } = req.body;
    const newMaterial = new Material({
      title,
      link,
      unitId,
      uploadedBy: req.user.id,
      createdAt: new Date()
    });
    await newMaterial.save();
    res.status(201).json(newMaterial);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete a material
app.delete('/api/materials/:id', authMiddleware, async (req, res) => {
  try {
    await Material.findByIdAndDelete(req.params.id);
    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   STUDENT FULL GRADES ROUTE
===================== */
app.get('/api/my-grades-full', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json({ results: [] });
    }

    // Get all units for student's course
    const units = await Unit.find({ courseId: student.courseId });

    // For each unit get grade and attendance
    const results = await Promise.all(units.map(async (unit) => {
      const grade = await Grade.findOne({
        studentId: req.user.id,
        unitId: unit._id
      });

      const attendance = await Attendance.findOne({
        studentId: req.user.id,
        unitId: unit._id
      });

      return { unit, grade, attendance };
    }));

    res.json({ results });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   STUDENT COURSE MATERIALS
===================== */
app.get('/api/my-course-materials', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json({ materials: [], units: [] });
    }

    // Get all units for student's course
    const units = await Unit.find({ courseId: student.courseId });
    const unitIds = units.map(u => u._id.toString());

    // Get all materials for those units
    const materials = await Material.find({
      unitId: { $in: unitIds }
    }).sort({ createdAt: -1 });

    res.json({ materials, units });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
/* =====================
   ADMIN ATTENDANCE RECORDS
===================== */
app.get('/api/admin/attendance', authMiddleware, async (req, res) => {
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

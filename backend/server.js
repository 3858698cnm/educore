const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please add them in Render → Environment tab, then redeploy.');
  process.exit(1);
}
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
require('./sockets/liveClass')(io);

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
app.use(require('./routes/profile'));
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('EduCore server running on port ' + PORT);
});

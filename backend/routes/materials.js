const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Material = require('../models/Material');
const Unit = require('../models/Unit');
const User = require('../models/User');

const upload = multer({ storage: multer.memoryStorage() });

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

// Get all materials uploaded by this lecturer
router.get('/api/my-materials', authMiddleware, async (req, res) => {
  try {
    const materials = await Material.find({ uploadedBy: req.user.id });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get materials for a specific unit
router.get('/api/materials/unit/:unitId', authMiddleware, async (req, res) => {
  try {
    const materials = await Material.find({ unitId: req.params.unitId });
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Upload a material (with file)
router.post('/api/materials', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { unitId, title } = req.body;
    let link = req.body.link || '';

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'raw', folder: 'educore-materials' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      link = uploadResult.secure_url;
    }

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
router.delete('/api/materials/:id', authMiddleware, async (req, res) => {
  try {
    await Material.findByIdAndDelete(req.params.id);
    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get materials for a student's enrolled course
router.get('/api/my-course-materials', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student.courseId) {
      return res.json({ materials: [], units: [] });
    }

    const units = await Unit.find({ courseId: student.courseId });
    const unitIds = units.map(u => u._id.toString());

    const materials = await Material.find({
      unitId: { $in: unitIds }
    }).sort({ createdAt: -1 });

    res.json({ materials, units });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
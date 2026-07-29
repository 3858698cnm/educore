const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

router.post('/api/register', async (req, res) => {
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

router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    let user;
    if (email.includes('/')) {
      user = await User.findOne({ admissionNumber: email.toUpperCase() });
      if (!user) return res.status(400).json({ message: 'Admission number not found' });
    } else {
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

router.post('/api/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

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

router.post('/api/reset-password', async (req, res) => {
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

module.exports = router;
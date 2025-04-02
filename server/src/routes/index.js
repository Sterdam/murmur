const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const messageRoutes = require('./messages');
const groupRoutes = require('./groups');

const router = express.Router();

// API version and health check
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Murmur API is running',
    version: '1.0.0',
  });
});

// Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/messages', messageRoutes);
router.use('/groups', groupRoutes);

module.exports = router;

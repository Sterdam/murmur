const express = require('express');
const { getMessages, sendMessage } = require('../controllers/messages');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(authMiddleware);

// Get conversation messages
router.get('/:conversationId', getMessages);

// Send a message (fallback for when WebSockets are not available)
router.post('/', sendMessage);

module.exports = router;

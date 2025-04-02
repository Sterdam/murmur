// server/src/routes/users.js
const express = require('express');
const { 
  getUserProfile, 
  updateUserProfile, 
  searchUsers, 
  addContact, 
  getContacts,
  sendContactRequest,
  getContactRequests,
  acceptContactRequest,
  rejectContactRequest
} = require('../controllers/users');
const authMiddleware = require('../middleware/auth');
const geoRestriction = require('../middleware/geoRestriction');

const router = express.Router();

// Protect all routes
router.use(authMiddleware);

// Add geo restriction for sensitive operations
const sensitiveRouteGeoRestriction = geoRestriction({ strictMode: true });

// Get current user profile
router.get('/profile', getUserProfile);

// Update user profile
router.put('/profile', updateUserProfile);

// Update user settings with geo restriction
router.put('/settings', sensitiveRouteGeoRestriction, updateUserProfile);

// Update user keys with geo restriction
router.put('/keys', sensitiveRouteGeoRestriction, updateUserProfile);

// Search for users
router.get('/search', searchUsers);

// Contact management
router.post('/contacts', addContact);
router.get('/contacts', getContacts);

// Contact request management
router.post('/contact-requests', sendContactRequest);
router.get('/contact-requests', getContactRequests);
router.post('/contact-requests/:requestId/accept', acceptContactRequest);
router.post('/contact-requests/:requestId/reject', rejectContactRequest);

module.exports = router;
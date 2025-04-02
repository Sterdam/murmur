const express = require('express');
const { 
  getUserProfile, 
  updateUserProfile, 
  searchUsers, 
  addContact, 
  getContacts 
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

// Add a contact
router.post('/contacts', addContact);

// Get user contacts
router.get('/contacts', getContacts);

module.exports = router;

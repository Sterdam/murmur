const express = require('express');
const { registerUser, loginUser, generateKeys } = require('../controllers/auth');
const geoRestriction = require('../middleware/geoRestriction');

const router = express.Router();

// Add geo restriction for auth routes
const authGeoRestriction = geoRestriction({
  strictMode: false,
  // blockedCountries will be set from environment variables
});

// Register a new user with geo restriction
router.post('/register', authGeoRestriction, registerUser);

// Login a user with geo restriction
router.post('/login', authGeoRestriction, loginUser);

// Generate encryption keys with geo restriction
router.get('/keys/generate', authGeoRestriction, generateKeys);

module.exports = router;

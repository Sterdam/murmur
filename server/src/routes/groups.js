const express = require('express');
const { 
  createGroup, 
  getGroup, 
  getUserGroups, 
  updateGroup, 
  addGroupMembers, 
  removeGroupMember 
} = require('../controllers/groups');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(authMiddleware);

// Create a new group
router.post('/', createGroup);

// Get all user groups
router.get('/', getUserGroups);

// Get a specific group
router.get('/:groupId', getGroup);

// Update group details
router.put('/:groupId', updateGroup);

// Add members to a group
router.post('/:groupId/members', addGroupMembers);

// Remove a member from a group
router.delete('/:groupId/members', removeGroupMember);

module.exports = router;

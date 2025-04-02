const { storeGroup, getGroupById, getUserGroups } = require('../services/redis');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.createGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, members = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }
    
    // Make sure creator is included in members
    const allMembers = [...new Set([userId, ...members])];
    
    // Create group
    const group = {
      id: uuidv4(),
      name,
      createdBy: userId,
      members: allMembers,
      createdAt: Date.now(),
    };
    
    const groupId = await storeGroup(group);
    
    res.status(201).json({
      success: true,
      data: {
        ...group,
        id: groupId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    
    // Get group
    const group = await getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }
    
    // Check if user is a member
    if (!group.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }
    
    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's groups
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserGroups = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get group IDs
    const groupIds = await getUserGroups(userId);
    
    // Get group details
    const groups = await Promise.all(
      groupIds.map(async (groupId) => {
        return getGroupById(groupId);
      })
    );
    
    // Filter out null values (deleted groups)
    const validGroups = groups.filter(Boolean);
    
    res.status(200).json({
      success: true,
      data: validGroups,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update group details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.updateGroup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { name, members } = req.body;
    
    // Get current group
    const group = await getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }
    
    // Only creator can update group
    if (group.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can update the group',
      });
    }
    
    // Update fields
    const updates = {};
    
    if (name) {
      updates.name = name;
    }
    
    if (members && Array.isArray(members)) {
      // Make sure creator is still included
      updates.members = [...new Set([userId, ...members])];
    }
    
    // No updates provided
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided',
      });
    }
    
    // Update group
    const updatedGroup = {
      ...group,
      ...updates,
      updatedAt: Date.now(),
    };
    
    await storeGroup(updatedGroup);
    
    res.status(200).json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add members to a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.addGroupMembers = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { members } = req.body;
    
    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Members array is required',
      });
    }
    
    // Get current group
    const group = await getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }
    
    // Check if user is a member
    if (!group.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }
    
    // Add new members
    const newMembers = [...new Set([...group.members, ...members])];
    
    // Update group
    const updatedGroup = {
      ...group,
      members: newMembers,
      updatedAt: Date.now(),
    };
    
    await storeGroup(updatedGroup);
    
    res.status(200).json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove member from a group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.removeGroupMember = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { memberId } = req.body;
    
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required',
      });
    }
    
    // Get current group
    const group = await getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }
    
    // Only group creator can remove others, or users can remove themselves
    if (group.createdBy !== userId && memberId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove this member',
      });
    }
    
    // Creator cannot be removed
    if (memberId === group.createdBy && userId !== group.createdBy) {
      return res.status(403).json({
        success: false,
        message: 'The group creator cannot be removed',
      });
    }
    
    // Remove member
    const newMembers = group.members.filter(id => id !== memberId);
    
    // Update group
    const updatedGroup = {
      ...group,
      members: newMembers,
      updatedAt: Date.now(),
    };
    
    await storeGroup(updatedGroup);
    
    res.status(200).json({
      success: true,
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
};

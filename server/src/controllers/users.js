const { getUserById, getUserByUsername, addContact, getUserContacts, storeUser } = require('../services/redis');

/**
 * Get user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Remove sensitive data
    const { password, ...userProfile } = user;
    
    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const allowedFields = ['publicKey', 'displayName', 'bio', 'allowedRegions', 'settings'];
    
    // Get current user data
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Update only allowed fields
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Special handling for allowedRegions to ensure it's an array
        if (field === 'allowedRegions') {
          const regions = req.body[field];
          if (Array.isArray(regions)) {
            updates[field] = regions.filter(region => typeof region === 'string' && region.length === 2);
          }
        } 
        // Special handling for settings object to merge instead of replace
        else if (field === 'settings') {
          updates[field] = {
            ...(user.settings || {}),
            ...req.body[field]
          };
        }
        else {
          updates[field] = req.body[field];
        }
      }
    });
    
    // Update user data
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: Date.now(),
    };
    
    await storeUser(updatedUser);
    
    // Remove sensitive data
    const { password, ...userProfile } = updatedUser;
    
    res.status(200).json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search for users by username
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username search term is required',
      });
    }
    
    // For simplicity, this just searches for exact username
    // In a real app, you'd want to use a search index
    const user = await getUserByUsername(username);
    
    if (!user || user.id === req.user.id) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }
    
    // Remove sensitive data
    const { password, ...userProfile } = user;
    
    res.status(200).json({
      success: true,
      data: [userProfile],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a contact
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.addContact = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { contactId, username } = req.body;
    
    if (!contactId && !username) {
      return res.status(400).json({
        success: false,
        message: 'Either contactId or username is required',
      });
    }
    
    let contactUser;
    
    // Check if we're adding by ID or username
    if (contactId) {
      contactUser = await getUserById(contactId);
    } else if (username) {
      contactUser = await getUserByUsername(username);
    }
    
    if (!contactUser) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }
    
    // Don't allow adding yourself as a contact
    if (contactUser.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add yourself as a contact',
      });
    }
    
    // Add contact
    await addContact(userId, contactUser.id);
    
    // Return the contact info
    const { password, ...contactInfo } = contactUser;
    
    res.status(200).json({
      success: true,
      message: 'Contact added successfully',
      data: contactInfo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user contacts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getContacts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get contact IDs
    const contactIds = await getUserContacts(userId);
    
    // Get contact details
    const contacts = await Promise.all(
      contactIds.map(async (contactId) => {
        const user = await getUserById(contactId);
        if (!user) return null;
        
        // Remove sensitive data
        const { password, ...contactProfile } = user;
        return contactProfile;
      })
    );
    
    // Filter out null values (deleted contacts)
    const validContacts = contacts.filter(Boolean);
    
    res.status(200).json({
      success: true,
      data: validContacts,
    });
  } catch (error) {
    next(error);
  }
};
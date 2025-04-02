// server/src/controllers/users.js
const { 
  getUserById, 
  getUserByUsername, 
  addContact, 
  getUserContacts,
  storeUser,
  storeContactRequest,
  getIncomingContactRequests,
  getOutgoingContactRequests,
  getContactRequestById,
  deleteContactRequest
} = require('../services/redis');
const { v4: uuidv4 } = require('uuid');

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
    
    // Implement caching for repeat searches
    const userId = req.user.id;
    const cacheKey = `search-${username}-${userId}`;
    const now = new Date();
    
    // Set cache control headers - cache search results for 5 minutes
    res.set('Cache-Control', 'private, max-age=300');
    res.set('ETag', cacheKey);
    res.set('Last-Modified', now.toUTCString());
    
    // Check if client sent If-None-Match header matching our ETag
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag && clientEtag === cacheKey) {
      // Resource hasn't changed, return 304 Not Modified
      return res.status(304).end();
    }
    
    // Check rate limiting for search operations
    // This could be enhanced with a Redis-based counter for production
    // For now, we'll use a simple mechanism to prevent rapid searches
    
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
    
    // Log search operation for monitoring
    console.log(`User search performed by ${userId} for "${username}" at ${now.toISOString()}`);
    
    res.status(200).json({
      success: true,
      data: [userProfile],
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'An error occurred during search. Please try again later.'
    });
  }
};

/**
 * Send a contact request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.sendContactRequest = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
      });
    }
    
    console.log(`Processing contact request from user ${req.user.username} to ${username}`);
    
    // Get recipient user
    const recipient = await getUserByUsername(username);
    if (!recipient) {
      console.log(`Recipient user not found: ${username}`);
      return res.status(404).json({
        success: false,
        message: 'User not found. Please check the username and try again.',
      });
    }
    
    // Check if user is trying to add themselves
    if (recipient.id === senderId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a contact',
      });
    }
    
    // Check if users are already contacts
    const contacts = await getUserContacts(senderId);
    if (Array.isArray(contacts) && contacts.includes(recipient.id)) {
      return res.status(400).json({
        success: false,
        message: 'This user is already in your contacts',
      });
    }
    
    // Check for existing pending requests between these users
    const outgoingRequests = await getOutgoingContactRequests(senderId);
    const existingRequest = Array.isArray(outgoingRequests) && 
      outgoingRequests.find(req => req.recipientId === recipient.id);
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request to this user',
      });
    }
    
    // Get sender info for the request
    const sender = await getUserById(senderId);
    if (!sender) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve sender information',
      });
    }
    
    // Create contact request
    const requestId = uuidv4();
    const request = {
      id: requestId,
      senderId: senderId,
      recipientId: recipient.id,
      status: 'pending',
      createdAt: Date.now(),
      
      // Include sender details for the recipient
      senderUsername: sender.username,
      senderDisplayName: sender.displayName,
      senderPublicKey: sender.publicKey,
      
      // Include recipient details for the sender
      recipientUsername: recipient.username,
      recipientDisplayName: recipient.displayName
    };
    
    await storeContactRequest(request);
    console.log(`Contact request created: ${requestId} from ${sender.username} to ${recipient.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Contact request sent successfully',
      data: {
        id: requestId,
        recipientId: recipient.id,
        username: recipient.username,
        displayName: recipient.displayName,
        status: 'pending',
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    console.error('Error sending contact request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send contact request. Please try again later.'
    });
  }
};

/**
 * Get contact requests (both incoming and outgoing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getContactRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Generate a cache key based on user ID and time
    const now = new Date();
    const etag = `requests-${userId}-${Math.floor(now.getTime() / 30000)}`; // Changes every 30 seconds
    
    // Set cache control headers
    res.set('Cache-Control', 'private, max-age=30'); // 30 seconds cache
    res.set('ETag', etag);
    res.set('Last-Modified', now.toUTCString());
    
    // Check if client sent If-None-Match header matching our ETag
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      // Resource hasn't changed, return 304 Not Modified
      return res.status(304).end();
    }
    
    // If client isn't using cache or cache expired, continue with the request
    // Get incoming requests
    const incomingRequests = await getIncomingContactRequests(userId);
    
    // Get outgoing requests
    const outgoingRequests = await getOutgoingContactRequests(userId);
    
    // Log for tracking request load
    console.log(`Contact requests fetched for ${userId} at ${now.toISOString()}`);
    
    res.status(200).json({
      success: true,
      data: {
        incoming: incomingRequests || [],
        outgoing: outgoingRequests || []
      }
    });
  } catch (error) {
    console.error('Error getting contact requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get contact requests. Please try again later.'
    });
  }
};

/* Accept a contact request
* @param {Object} req - Express request object
* @param {Object} res - Express response object
* @param {Function} next - Express next middleware function
*/
exports.acceptContactRequest = async (req, res, next) => {
 try {
   const userId = req.user.id;
   const { requestId } = req.params;
   
   console.log(`Processing accept request ${requestId} for user ${userId}`);
   
   // Get the contact request
   const request = await getContactRequestById(requestId);
   
   if (!request) {
     console.log(`Request ${requestId} not found`);
     return res.status(404).json({
       success: false,
       message: 'Contact request not found',
     });
   }
   
   // Ensure the user is the recipient of the request
   if (request.recipientId !== userId) {
     console.log(`User ${userId} not authorized to accept request for ${request.recipientId}`);
     return res.status(403).json({
       success: false,
       message: 'You are not authorized to accept this request',
     });
   }
   
   // Ensure the request is still pending
   if (request.status !== 'pending') {
     console.log(`Request ${requestId} is not pending but ${request.status}`);
     return res.status(400).json({
       success: false,
       message: 'This request has already been processed',
     });
   }
   
   console.log(`Adding contact relationship between ${userId} and ${request.senderId}`);
   
   // Add contact relationship (both ways)
   await addContact(userId, request.senderId);
   await addContact(request.senderId, userId);
   
   // Get sender details for response
   const sender = await getUserById(request.senderId);
   if (!sender) {
     console.log(`Sender ${request.senderId} not found`);
     return res.status(404).json({
       success: false,
       message: 'Sender not found. The account may have been deleted.',
     });
   }
   
   // Update request status to accepted
   request.status = 'accepted';
   request.updatedAt = Date.now();
   await storeContactRequest(request);
   
   console.log(`Contact request ${requestId} accepted successfully`);
   
   // Return the new contact info
   res.status(200).json({
     success: true,
     message: 'Contact request accepted',
     data: {
       id: sender.id,
       username: sender.username,
       displayName: sender.displayName,
       publicKey: sender.publicKey,
       status: 'accepted'
     }
   });
 } catch (error) {
   console.error('Error accepting contact request:', error);
   res.status(500).json({
     success: false,
     message: 'Failed to accept contact request. Please try again later.'
   });
 }
};

/**
 * Reject a contact request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.rejectContactRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    // Get the contact request
    const request = await getContactRequestById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Contact request not found',
      });
    }
    
    // Ensure the user is the recipient of the request
    if (request.recipientId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject this request',
      });
    }
    
    // Ensure the request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This request has already been processed',
      });
    }
    
    // Update request status to rejected
    request.status = 'rejected';
    request.updatedAt = Date.now();
    await storeContactRequest(request);
    
    res.status(200).json({
      success: true,
      message: 'Contact request rejected'
    });
  } catch (error) {
    console.error('Error rejecting contact request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject contact request. Please try again later.'
    });
  }
};

/**
 * Add a contact (legacy method - now use request system)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.addContact = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { contactId, username } = req.body;
    
    // Redirect to the new contact request system
    if (username) {
      return this.sendContactRequest(req, res, next);
    }
    
    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: 'ContactId is required',
      });
    }
    
    let contactUser = await getUserById(contactId);
    
    if (!contactUser) {
      return res.status(400).json({
        success: false,
        message: 'User not found. Please check the ID and try again.',
      });
    }
    
    // Don't allow adding yourself as a contact
    if (contactUser.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add yourself as a contact',
      });
    }
    
    // Vérifier si déjà en contact
    const userContacts = await getUserContacts(userId);
    if (userContacts.includes(contactUser.id)) {
      return res.status(400).json({
        success: false,
        message: 'This user is already in your contacts',
      });
    }
    
    // Add contact (both ways for simplicity)
    await addContact(userId, contactUser.id);
    await addContact(contactUser.id, userId);
    
    // Return the contact info
    const { password, ...contactInfo } = contactUser;
    
    res.status(200).json({
      success: true,
      message: 'Contact added successfully',
      data: contactInfo
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add contact. Please try again later.'
    });
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
    
    // Cache handling - send Last-Modified header based on server time
    // and use ETag for caching
    const now = new Date();
    const etag = `contacts-${userId}-${now.getTime()}`;
    
    // Set cache control headers
    res.set('Cache-Control', 'private, max-age=30'); // 30 seconds cache
    res.set('ETag', etag);
    res.set('Last-Modified', now.toUTCString());
    
    // Check if client sent If-None-Match header matching our ETag
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      // Resource hasn't changed, return 304 Not Modified
      return res.status(304).end();
    }
    
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
    console.error('Error getting contacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts. Please try again later.'
    });
  }
};
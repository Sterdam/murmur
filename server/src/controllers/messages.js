const { getConversationMessages, storeMessage } = require('../services/redis');

/**
 * Get conversation messages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Validate if user is part of the conversation
    const isUserInConversation = conversationId.startsWith('group:') || 
                                conversationId.split(':').includes(userId);
                                
    console.log(`Checking conversation access: ${conversationId}, User: ${userId}, Access: ${isUserInConversation}`);
    
    if (!isUserInConversation) {
      console.error(`User ${userId} attempted unauthorized access to conversation ${conversationId}`);
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to conversation',
      });
    }
    
    // Get messages
    const messages = await getConversationMessages(
      conversationId,
      parseInt(limit, 10),
      parseInt(offset, 10)
    );
    
    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message via HTTP API (fallback for when WebSockets are not available)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const { recipientId, groupId, message, encryptedKey, encryptedKeys } = req.body;
    
    // Validate input
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
    }
    
    if (!recipientId && !groupId) {
      return res.status(400).json({
        success: false,
        message: 'Either recipientId or groupId is required',
      });
    }
    
    let messageData;
    
    if (recipientId) {
      // Direct message
      if (!encryptedKey) {
        return res.status(400).json({
          success: false,
          message: 'Encrypted key is required for direct messages',
        });
      }
      
      messageData = {
        senderId,
        recipientId,
        conversationId: [senderId, recipientId].sort().join(':'),
        message,
        encryptedKey,
        isRead: false,
      };
    } else {
      // Group message
      if (!encryptedKeys) {
        return res.status(400).json({
          success: false,
          message: 'Encrypted keys are required for group messages',
        });
      }
      
      messageData = {
        senderId,
        groupId,
        conversationId: `group:${groupId}`,
        message,
        encryptedKeys,
      };
    }
    
    // Store message
    const messageId = await storeMessage(messageData);
    
    res.status(201).json({
      success: true,
      data: {
        id: messageId,
        ...messageData,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    next(error);
  }
};

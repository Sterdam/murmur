const { verifyToken } = require('./auth');
const { storeMessage, getUserById } = require('./redis');
const geoRestrictionCheck = require('../middleware/geoRestriction');

// Store active user connections
const activeConnections = new Map();

// Helper function to get client IP address
const getClientIp = (socket) => {
  return socket.handshake.headers['x-forwarded-for'] || 
         socket.request.connection.remoteAddress;
};

/**
 * Initialize socket.io connections
 * @param {Object} io - Socket.io server instance
 */
module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      // Verify auth token
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = verifyToken(token);
      
      // Get user data
      const user = await getUserById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Check geo-restrictions
      const ip = getClientIp(socket);
      const clientRegion = socket.handshake.headers['x-client-region'] || null;
      
      // Create mock request/response objects to use the middleware
      const mockReq = {
        ip,
        headers: socket.handshake.headers,
        user: {
          id: user.id,
          username: user.username,
          allowedRegions: user.allowedRegions
        }
      };
      
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (code !== 200) {
              return next(new Error(data.message || 'Geo-restriction: Access denied'));
            }
          }
        })
      };
      
      // Use a modified version of geo restriction
      // with strictMode only if user has allowedRegions set
      const geoOptions = {
        strictMode: Array.isArray(user.allowedRegions) && user.allowedRegions.length > 0
      };
      
      const geoCheck = geoRestrictionCheck(geoOptions);
      
      // Apply geo-restriction check
      await new Promise((resolve) => {
        geoCheck(mockReq, mockRes, resolve);
      });
      
      // Attach user to socket
      socket.user = {
        id: user.id,
        username: user.username,
        allowedRegions: user.allowedRegions
      };
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${socket.user.username}`);
    
    // Store user connection
    activeConnections.set(userId, socket.id);
    
    // Join user's private room
    socket.join(`user:${userId}`);
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username}`);
      activeConnections.delete(userId);
    });
    
    // Handle joining groups
    socket.on('join-group', (groupId) => {
      socket.join(`group:${groupId}`);
    });
    
    // Handle leaving groups
    socket.on('leave-group', (groupId) => {
      socket.leave(`group:${groupId}`);
    });
    
    // Handle private messages
    socket.on('private-message', async (data) => {
      try {
        const { recipientId, message, encryptedKey } = data;
        
        // Store message in Redis
        const messageId = await storeMessage({
          senderId: userId,
          recipientId,
          conversationId: [userId, recipientId].sort().join(':'),
          message,
          encryptedKey,
          isRead: false,
        });
        
        // Check if recipient is online
        const recipientSocketId = activeConnections.get(recipientId);
        
        if (recipientSocketId) {
          // Send message to recipient
          io.to(`user:${recipientId}`).emit('private-message', {
            id: messageId,
            senderId: userId,
            senderUsername: socket.user.username,
            message,
            encryptedKey,
            timestamp: Date.now(),
          });
        }
        
        // Confirm delivery to sender
        socket.emit('message-delivered', {
          id: messageId,
          recipientId,
          delivered: !!recipientSocketId,
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle group messages
    socket.on('group-message', async (data) => {
      try {
        const { groupId, message, encryptedKeys } = data;
        
        // Store message in Redis
        const messageId = await storeMessage({
          senderId: userId,
          groupId,
          conversationId: `group:${groupId}`,
          message,
          encryptedKeys,
        });
        
        // Broadcast message to group
        io.to(`group:${groupId}`).emit('group-message', {
          id: messageId,
          senderId: userId,
          senderUsername: socket.user.username,
          groupId,
          message,
          encryptedKeys,
          timestamp: Date.now(),
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to send group message' });
      }
    });
    
    // Handle message read status
    socket.on('mark-as-read', async (messageId) => {
      // Implementation will be added later
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      const { conversationId } = data;
      
      if (conversationId.startsWith('group:')) {
        // Group conversation
        const groupId = conversationId.replace('group:', '');
        socket.to(`group:${groupId}`).emit('typing', {
          senderId: userId,
          senderUsername: socket.user.username,
          conversationId,
        });
      } else {
        // Private conversation
        const participants = conversationId.split(':');
        const recipientId = participants[0] === userId ? participants[1] : participants[0];
        
        // Send typing indicator to recipient if they're online
        const recipientSocketId = activeConnections.get(recipientId);
        if (recipientSocketId) {
          socket.to(`user:${recipientId}`).emit('typing', {
            senderId: userId,
            senderUsername: socket.user.username,
            conversationId,
          });
        }
      }
    });
  });
};
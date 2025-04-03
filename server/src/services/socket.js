// server/src/services/socket.js - Corrigé
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
      
      // Décodage du token
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (tokenError) {
        console.error('Token verification error:', tokenError);
        return next(new Error('Invalid token'));
      }
      
      // Get user data
      const user = await getUserById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Check geo-restrictions (désactivé en développement)
      if (process.env.NODE_ENV === 'production') {
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
      }
      
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
    console.log(`User connected: ${socket.user.username} (${userId})`);
    
    // Store user connection
    activeConnections.set(userId, socket.id);
    
    // Join user's private room
    socket.join(`user:${userId}`);
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${userId})`);
      activeConnections.delete(userId);
    });
    
    // Handle joining groups
    socket.on('join-group', (groupId) => {
      if (!groupId) {
        console.warn('Invalid group ID provided');
        return;
      }
      socket.join(`group:${groupId}`);
      console.log(`User ${socket.user.username} joined group ${groupId}`);
    });
    
    // Handle leaving groups
    socket.on('leave-group', (groupId) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
      console.log(`User ${socket.user.username} left group ${groupId}`);
    });
    
    // Handle private messages
    socket.on('private-message', async (data) => {
      try {
        console.log('Received private message from socket:', {
          user: socket.user.username,
          userId: userId,
          recipient: data.recipientId,
          hasEncryptedKey: !!data.encryptedKey,
          hasMetadata: !!data.metadata
        });
        
        const { recipientId, message, encryptedKey, metadata } = data;
        
        // Validation de base
        if (!recipientId || !message) {
          console.error('Invalid message data received:', data);
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }
        
        // Normaliser l'ID de conversation (trier les IDs)
        const conversationId = [userId, recipientId].sort().join(':');
        console.log(`Normalized conversation ID: ${conversationId}`);
        
        // Store message in Redis with all the information
        const messageId = await storeMessage({
          senderId: userId,
          senderUsername: socket.user.username,
          recipientId,
          conversationId: conversationId,
          message,
          encryptedKey,
          metadata,
          isRead: false,
          timestamp: data.timestamp || Date.now(),
        });
        
        console.log(`Message stored in Redis with ID: ${messageId}`);
        
        // Check if recipient is online
        const recipientSocketId = activeConnections.get(recipientId);
        
        if (recipientSocketId) {
          console.log(`Recipient ${recipientId} is online, sending message directly`);
          
          // Send message to recipient with all encryption information
          io.to(`user:${recipientId}`).emit('private-message', {
            id: messageId,
            senderId: userId,
            senderUsername: socket.user.username,
            recipientId: recipientId,
            conversationId: conversationId, // Important: Utiliser l'ID normalisé
            message,
            encryptedKey,
            metadata,
            timestamp: data.timestamp || Date.now(),
          });
        } else {
          console.log(`Recipient ${recipientId} is offline, message will be delivered later`);
        }
        
        // Confirm delivery to sender
        socket.emit('message-delivered', {
          id: messageId,
          recipientId,
          conversationId: conversationId, // Important: Utiliser l'ID normalisé
          delivered: !!recipientSocketId,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error processing private message:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
      }
    });
    
    // Handle group messages
    socket.on('group-message', async (data) => {
      try {
        console.log('Received group message from socket:', {
          user: socket.user.username,
          group: data.groupId,
          hasEncryptedKeys: !!data.encryptedKeys && Object.keys(data.encryptedKeys || {}).length > 0,
          hasMetadata: !!data.metadata
        });
        
        const { groupId, message, encryptedKeys, metadata } = data;
        
        // Validation
        if (!groupId || !message) {
          console.error('Invalid group message data received:', data);
          socket.emit('error', { message: 'Invalid group message data' });
          return;
        }
        
        // Normaliser l'ID de conversation pour les groupes
        const conversationId = `group:${groupId}`;
        
        // Store message in Redis with all information
        const messageId = await storeMessage({
          senderId: userId,
          senderUsername: socket.user.username,
          groupId,
          conversationId,
          message,
          encryptedKeys,
          metadata,
          timestamp: data.timestamp || Date.now(),
        });
        
        console.log(`Group message stored in Redis with ID: ${messageId} for group: ${groupId}`);
        
        // Broadcast message to group with all encryption information
        io.to(`group:${groupId}`).emit('group-message', {
          id: messageId,
          senderId: userId,
          senderUsername: socket.user.username,
          groupId,
          conversationId, // Important: Utiliser l'ID normalisé
          message,
          encryptedKeys,
          metadata,
          timestamp: data.timestamp || Date.now(),
        });
        
        console.log(`Group message ${messageId} broadcast to group: ${groupId}`);
      } catch (error) {
        console.error('Error processing group message:', error);
        socket.emit('error', { message: 'Failed to send group message: ' + error.message });
      }
    });
    
    // Handle message read status
    socket.on('mark-as-read', async (messageId) => {
      // Implementation will be added later
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      const { conversationId } = data;
      if (!conversationId) return;
      
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
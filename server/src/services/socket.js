// server/src/services/socket.js
const { verifyToken } = require('./auth');
const { storeMessage, getUserById } = require('./redis');
const geoRestrictionCheck = require('../middleware/geoRestriction');

// Store active user connections
const activeConnections = new Map();
const userRooms = new Map(); // Garder trace des rooms de chaque utilisateur

// Helper function to get client IP address
const getClientIp = (socket) => {
  return socket.handshake.headers['x-forwarded-for'] || 
         socket.request.connection.remoteAddress;
};

// Fonction pour normaliser les IDs de conversation - COHÉRENTE avec le client
const normalizeConversationId = (id) => {
  if (!id) return id;
  
  // Si c'est un ID de groupe, le laisser tel quel
  if (id.startsWith('group:')) return id;
  
  // Si c'est un ID direct au format "id1:id2", trier les parties pour consistance
  if (id.includes(':')) {
    const parts = id.split(':').filter(Boolean);
    if (parts.length === 2) {
      return parts.sort().join(':');
    }
  }
  
  // Si c'est un UUID ou autre format non reconnu, le retourner tel quel
  return id;
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
    console.log(`User connected: ${socket.user.username} (${userId}), socket ID: ${socket.id}`);
    
    // Store user connection
    activeConnections.set(userId, socket.id);
    
    // Join user's private room and update userRooms
    socket.join(`user:${userId}`);
    userRooms.set(userId, new Set([`user:${userId}`]));
    
    // Join all existing conversations for this user
    // (Cette fonctionnalité pourrait être implémentée pour rejoindre automatiquement les conversations existantes)
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${userId})`);
      activeConnections.delete(userId);
      userRooms.delete(userId);
    });
    
    // Handle joining groups
    socket.on('join-group', (groupId) => {
      if (!groupId) {
        console.warn('Invalid group ID provided');
        return;
      }
      
      const roomId = `group:${groupId}`;
      socket.join(roomId);
      
      // Mettre à jour la liste des rooms de l'utilisateur
      if (!userRooms.has(userId)) {
        userRooms.set(userId, new Set());
      }
      userRooms.get(userId).add(roomId);
      
      console.log(`User ${socket.user.username} joined group ${groupId}, room: ${roomId}`);
    });
    
    // Handle leaving groups
    socket.on('leave-group', (groupId) => {
      if (!groupId) return;
      
      const roomId = `group:${groupId}`;
      socket.leave(roomId);
      
      // Mettre à jour la liste des rooms de l'utilisateur
      if (userRooms.has(userId)) {
        userRooms.get(userId).delete(roomId);
      }
      
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
        
        // Normaliser l'ID de conversation (trier les IDs) - IMPORTANT pour la cohérence
        const conversationId = normalizeConversationId([userId, recipientId].join(':'));
        console.log(`Normalized conversation ID: ${conversationId}`);
        
        // Générer un ID de message unique
        const messageId = Date.now().toString() + Math.floor(Math.random() * 10000);
        
        // Store message in Redis with all the information
        await storeMessage({
          id: messageId,
          senderId: userId,
          senderUsername: socket.user.username,
          recipientId,
          conversationId,
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
          console.log(`Recipient ${recipientId} is online, sending message directly to socket ${recipientSocketId}`);
          
          // Faire rejoindre la room de conversation au destinataire si nécessaire
          const recipientRooms = userRooms.get(recipientId) || new Set();
          if (!recipientRooms.has(`conversation:${conversationId}`)) {
            const recipientSocket = io.sockets.sockets.get(recipientSocketId);
            if (recipientSocket) {
              recipientSocket.join(`conversation:${conversationId}`);
              recipientRooms.add(`conversation:${conversationId}`);
            }
          }
          
          // Send message to recipient with all encryption information
          io.to(`user:${recipientId}`).emit('private-message', {
            id: messageId,
            senderId: userId,
            senderUsername: socket.user.username,
            recipientId,
            conversationId,
            message,
            encryptedKey,
            metadata,
            timestamp: data.timestamp || Date.now(),
          });
          
          console.log(`Message sent to recipient in room user:${recipientId}`);
        } else {
          console.log(`Recipient ${recipientId} is offline, message will be delivered later`);
        }
        
        // Confirm delivery to sender
        socket.emit('message-delivered', {
          id: messageId,
          recipientId,
          conversationId,
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
        
        // Générer un ID de message unique
        const messageId = Date.now().toString() + Math.floor(Math.random() * 10000);
        
        // Store message in Redis with all information
        await storeMessage({
          id: messageId,
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
        io.to(conversationId).emit('group-message', {
          id: messageId,
          senderId: userId,
          senderUsername: socket.user.username,
          groupId,
          conversationId,
          message,
          encryptedKeys,
          metadata,
          timestamp: data.timestamp || Date.now(),
        });
        
        console.log(`Group message ${messageId} broadcast to room: ${conversationId}`);
        
        // Confirm delivery to sender
        socket.emit('message-delivered', {
          id: messageId,
          groupId,
          conversationId,
          delivered: true,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Error processing group message:', error);
        socket.emit('error', { message: 'Failed to send group message: ' + error.message });
      }
    });
    
    // Handle message read status
    socket.on('mark-as-read', async (data) => {
      try {
        const { messageId, conversationId } = data;
        if (!messageId || !conversationId) return;
        
        console.log(`User ${userId} marked message ${messageId} as read in conversation ${conversationId}`);
        // Implementation pour mettre à jour le statut de lecture dans Redis
        // puis émettre un événement aux autres participants
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      const { conversationId } = data;
      if (!conversationId) return;
      
      if (conversationId.startsWith('group:')) {
        // Group conversation
        socket.to(conversationId).emit('typing', {
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
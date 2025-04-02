import { io } from 'socket.io-client';
import { addMessage, updateMessageStatus } from '../store/slices/messagesSlice';

let socket;
let dispatch;
let store;

/**
 * Initialize socket connection
 * @param {Object} appStore - Redux store
 */
const initSocket = (appStore) => {
  store = appStore;
  dispatch = store.dispatch;
  
  const token = store.getState().auth.token;
  
  if (!token) {
    console.error('No token available for socket connection');
    return;
  }
  
  const socketUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.murmur.app'
    : 'http://localhost:5000';
  
  socket = io(socketUrl, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
  
  // Socket event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  // Message handlers
  socket.on('private-message', handlePrivateMessage);
  socket.on('group-message', handleGroupMessage);
  socket.on('message-delivered', handleMessageDelivery);
  socket.on('typing', handleTypingIndicator);
  
  // Join user's groups
  const groups = store.getState().groups.groups;
  groups.forEach((group) => {
    socket.emit('join-group', group.id);
  });
};

/**
 * Handle private message received
 * @param {Object} data - Message data
 */
const handlePrivateMessage = async (data) => {
  try {
    // Decrypt message with user's private key
    const privateKey = store.getState().auth.privateKey;
    const decryptionService = await import('./encryption');
    
    const decryptedMessage = await decryptionService.decryptMessage(
      data.message,
      data.encryptedKey,
      privateKey
    );
    
    const currentUser = store.getState().auth.user;
    const conversationId = [currentUser.id, data.senderId].sort().join(':');
    
    // Add message to store
    dispatch(addMessage({
      message: {
        ...data,
        message: decryptedMessage,
        conversationId,
      },
    }));
    
    // Show notification if app is in background
    if (document.hidden) {
      showNotification(data.senderUsername, decryptedMessage);
    }
  } catch (error) {
    console.error('Error handling private message:', error);
  }
};

/**
 * Handle group message received
 * @param {Object} data - Message data
 */
const handleGroupMessage = async (data) => {
  try {
    // Get encrypted key for current user
    const currentUser = store.getState().auth.user;
    const encryptedKey = data.encryptedKeys[currentUser.id];
    
    if (!encryptedKey) {
      console.error('No encrypted key for user');
      return;
    }
    
    // Decrypt message with user's private key
    const privateKey = store.getState().auth.privateKey;
    const decryptionService = await import('./encryption');
    
    const decryptedMessage = await decryptionService.decryptMessage(
      data.message,
      encryptedKey,
      privateKey
    );
    
    const conversationId = `group:${data.groupId}`;
    
    // Add message to store
    dispatch(addMessage({
      message: {
        ...data,
        message: decryptedMessage,
        conversationId,
      },
    }));
    
    // Show notification if app is in background
    if (document.hidden) {
      // Get group name
      const group = store.getState().groups.groups.find((g) => g.id === data.groupId);
      const title = group ? `${data.senderUsername} in ${group.name}` : data.senderUsername;
      
      showNotification(title, decryptedMessage);
    }
  } catch (error) {
    console.error('Error handling group message:', error);
  }
};

/**
 * Handle message delivery status update
 * @param {Object} data - Delivery data
 */
const handleMessageDelivery = (data) => {
  const currentUser = store.getState().auth.user;
  const conversationId = [currentUser.id, data.recipientId].sort().join(':');
  
  dispatch(updateMessageStatus({
    messageId: data.id,
    conversationId,
    status: data.delivered ? 'delivered' : 'sent',
  }));
};

/**
 * Handle typing indicator
 * @param {Object} data - Typing data
 */
const handleTypingIndicator = (data) => {
  // Implement typing indicator UI
  // This will be handled by the UI components
};

/**
 * Send private message via socket
 * @param {Object} data - Message data
 */
const sendPrivateMessage = (data) => {
  if (socket && socket.connected) {
    socket.emit('private-message', data);
    return true;
  }
  return false;
};

/**
 * Send group message via socket
 * @param {Object} data - Message data
 */
const sendGroupMessage = (data) => {
  if (socket && socket.connected) {
    socket.emit('group-message', data);
    return true;
  }
  return false;
};

/**
 * Send typing indicator via socket
 * @param {Object} data - Typing data
 */
const sendTypingIndicator = (data) => {
  if (socket && socket.connected) {
    socket.emit('typing', data);
    return true;
  }
  return false;
};

/**
 * Join a group room
 * @param {string} groupId - Group ID
 */
const joinGroup = (groupId) => {
  if (socket && socket.connected) {
    socket.emit('join-group', groupId);
  }
};

/**
 * Leave a group room
 * @param {string} groupId - Group ID
 */
const leaveGroup = (groupId) => {
  if (socket && socket.connected) {
    socket.emit('leave-group', groupId);
  }
};

/**
 * Disconnect socket
 */
const disconnect = () => {
  if (socket) {
    socket.disconnect();
  }
};

/**
 * Check if socket is connected
 * @returns {boolean} - Socket connection status
 */
const isConnected = () => {
  return socket && socket.connected;
};

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 */
const showNotification = (title, body) => {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo192.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/logo192.png',
          });
        }
      });
    }
  }
};

export default {
  initSocket,
  sendPrivateMessage,
  sendGroupMessage,
  sendTypingIndicator,
  joinGroup,
  leaveGroup,
  disconnect,
  isConnected,
};

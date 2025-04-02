// client/src/services/socket.js
import { io } from 'socket.io-client';
import { addMessage, updateMessageStatus } from '../store/slices/messagesSlice';

let socket;
let dispatch;
let store;

/**
 * Initialisation de la connexion socket
 * @param {Object} appStore - Store Redux
 */
const initSocket = (appStore) => {
  try {
    store = appStore;
    dispatch = store.dispatch;
    
    const token = store.getState().auth.token;
    
    if (!token) {
      console.error('No token available for socket connection');
      return;
    }
    
    // Détermination de l'URL du socket basée sur l'environnement
    // Utiliser une URL relative pour éviter les problèmes de CORS
    const socketUrl = window.location.origin;
    
    // Création de la connexion socket
    socket = io(socketUrl, {
      auth: {
        token,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    
    // Gestionnaires d'événements socket
    socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    // Gestionnaires de messages
    socket.on('private-message', handlePrivateMessage);
    socket.on('group-message', handleGroupMessage);
    socket.on('message-delivered', handleMessageDelivery);
    socket.on('typing', handleTypingIndicator);
    
    // Rejoindre les groupes de l'utilisateur
    const groups = store.getState().groups.groups;
    if (Array.isArray(groups)) {
      groups.forEach((group) => {
        if (group && group.id) {
          socket.emit('join-group', group.id);
        }
      });
    }
  } catch (error) {
    console.error('Error initializing socket:', error);
  }
};

/**
 * Gestionnaire des messages privés reçus
 * @param {Object} data - Données du message
 */
const handlePrivateMessage = async (data) => {
  try {
    if (!dispatch || !store || !store.getState) {
      console.error('Store or dispatch not available');
      return;
    }
    
    // Déchiffrer le message avec la clé privée de l'utilisateur
    // Pour cet exemple, on va juste utiliser le message tel quel
    const decryptedMessage = data.message;
    
    const currentUser = store.getState().auth.user;
    if (!currentUser || !currentUser.id) {
      console.error('Current user not available');
      return;
    }
    
    const conversationId = [currentUser.id, data.senderId].sort().join(':');
    
    // Ajouter le message au store
    dispatch(addMessage({
      message: {
        ...data,
        message: decryptedMessage,
        conversationId,
      },
    }));
    
    // Afficher une notification si l'application est en arrière-plan
    if (document.hidden) {
      showNotification(data.senderUsername, decryptedMessage);
    }
  } catch (error) {
    console.error('Error handling private message:', error);
  }
};

/**
 * Gestionnaire des messages de groupe reçus
 * @param {Object} data - Données du message
 */
const handleGroupMessage = async (data) => {
  try {
    if (!dispatch || !store || !store.getState) {
      console.error('Store or dispatch not available for group message');
      return;
    }
    
    const currentUser = store.getState().auth.user;
    if (!currentUser || !currentUser.id) {
      console.error('Current user not available for group message');
      return;
    }
    
    // Récupérer la clé chiffrée pour l'utilisateur actuel
    const encryptedKey = data.encryptedKeys && data.encryptedKeys[currentUser.id];
    
    if (!encryptedKey) {
      console.error('No encrypted key for user in group message');
      return;
    }
    
    // Déchiffrer le message - simplified for now
    const decryptedMessage = data.message;
    
    const conversationId = `group:${data.groupId}`;
    
    // Ajouter le message au store
    dispatch(addMessage({
      message: {
        ...data,
        message: decryptedMessage,
        conversationId,
      },
    }));
    
    // Afficher une notification si l'application est en arrière-plan
    if (document.hidden) {
      // Récupérer le nom du groupe
      const groups = store.getState().groups.groups;
      const group = groups.find((g) => g.id === data.groupId);
      const title = group ? `${data.senderUsername} in ${group.name}` : data.senderUsername;
      
      showNotification(title, decryptedMessage);
    }
  } catch (error) {
    console.error('Error handling group message:', error);
  }
};

/**
 * Gestion de la mise à jour du statut de livraison des messages
 * @param {Object} data - Données de livraison
 */
const handleMessageDelivery = (data) => {
  try {
    if (!dispatch || !store || !store.getState) {
      console.error('Store or dispatch not available for message delivery');
      return;
    }
    
    const currentUser = store.getState().auth.user;
    if (!currentUser || !currentUser.id || !data.recipientId) {
      return;
    }
    
    const conversationId = [currentUser.id, data.recipientId].sort().join(':');
    
    dispatch(updateMessageStatus({
      messageId: data.id,
      conversationId,
      status: data.delivered ? 'delivered' : 'sent',
    }));
  } catch (error) {
    console.error('Error handling message delivery:', error);
  }
};

/**
 * Gestion des indicateurs de frappe
 * @param {Object} data - Données de frappe
 */
const handleTypingIndicator = (data) => {
  // Cette fonction sera implémentée par les composants UI
  // qui ont besoin d'afficher l'indicateur de frappe
};

/**
 * Envoi d'un message privé via socket
 * @param {Object} data - Données du message
 * @returns {boolean} - Succès de l'envoi
 */
const sendPrivateMessage = (data) => {
  if (socket && socket.connected) {
    socket.emit('private-message', data);
    return true;
  }
  return false;
};

/**
 * Envoi d'un message de groupe via socket
 * @param {Object} data - Données du message
 * @returns {boolean} - Succès de l'envoi
 */
const sendGroupMessage = (data) => {
  if (socket && socket.connected) {
    socket.emit('group-message', data);
    return true;
  }
  return false;
};

/**
 * Envoi d'un indicateur de frappe via socket
 * @param {Object} data - Données de frappe
 * @returns {boolean} - Succès de l'envoi
 */
const sendTypingIndicator = (data) => {
  if (socket && socket.connected) {
    socket.emit('typing', data);
    return true;
  }
  return false;
};

/**
 * Rejoindre un groupe
 * @param {string} groupId - ID du groupe
 */
const joinGroup = (groupId) => {
  if (socket && socket.connected) {
    socket.emit('join-group', groupId);
  }
};

/**
 * Quitter un groupe
 * @param {string} groupId - ID du groupe
 */
const leaveGroup = (groupId) => {
  if (socket && socket.connected) {
    socket.emit('leave-group', groupId);
  }
};

/**
 * Déconnexion du socket
 */
const disconnect = () => {
  if (socket) {
    socket.disconnect();
  }
};

/**
 * Vérification de la connexion du socket
 * @returns {boolean} - État de la connexion
 */
const isConnected = () => {
  return socket && socket.connected;
};

/**
 * Affichage d'une notification navigateur
 * @param {string} title - Titre de la notification
 * @param {string} body - Corps de la notification
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
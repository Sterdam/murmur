// client/src/services/socket.js
import { io } from 'socket.io-client';
import { addMessage, updateMessageStatus } from '../store/slices/messagesSlice';
import envConfig from '../config/env';

// Singleton pour le socket
let socket = null;

// Version simplifiée sans dépendance au store directement
const socketService = {
  // Connexion au serveur socket
  connect: (token) => {
    try {
      if (!token) {
        console.error('No token available for socket connection');
        return false;
      }

      // Si un socket existe déjà, le déconnecter d'abord
      if (socket) {
        socket.disconnect();
      }

      // Détermination de l'URL du socket basée sur l'environnement
      const socketUrl = process.env.REACT_APP_SOCKET_URL || envConfig.socketUrl;
      console.log(`Connecting to socket server: ${socketUrl}`);

      // Création de la connexion socket
      socket = io(socketUrl, {
        auth: { token },
        path: envConfig.socketPath,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        withCredentials: true,
      });

      // Configuration des événements de base
      socket.on('connect', () => {
        console.log('Socket connected successfully');
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      return true;
    } catch (error) {
      console.error('Error connecting to socket:', error);
      return false;
    }
  },

  // Déconnexion du serveur socket
  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('Socket disconnected manually');
      return true;
    }
    return false;
  },

  // Vérification de la connexion
  isConnected: () => {
    return socket && socket.connected;
  },

  // Configuration des gestionnaires d'événements - à appeler après une connexion réussie
  setupEventHandlers: (messageHandler, groupMessageHandler, deliveryHandler, typingHandler) => {
    if (!socket) {
      console.error('Socket not connected, cannot setup handlers');
      return false;
    }

    // Suppression des anciens gestionnaires s'ils existent
    socket.off('private-message');
    socket.off('group-message');
    socket.off('message-delivered');
    socket.off('typing');
    socket.off('error');

    // Ajouter un gestionnaire d'erreur général
    socket.on('error', (error) => {
      console.error('Socket error received:', error);
    });

    // Ajout des nouveaux gestionnaires
    if (messageHandler) {
      socket.on('private-message', (data) => {
        console.log('Socket received private message:', data);
        messageHandler(data);
      });
    }
    
    if (groupMessageHandler) {
      socket.on('group-message', (data) => {
        console.log('Socket received group message:', data);
        groupMessageHandler(data);
      });
    }
    
    if (deliveryHandler) {
      socket.on('message-delivered', (data) => {
        console.log('Socket received delivery confirmation:', data);
        deliveryHandler(data);
      });
    }
    
    if (typingHandler) {
      socket.on('typing', (data) => {
        typingHandler(data);
      });
    }

    return true;
  },

  // Joindre un groupe de discussion
  joinGroup: (groupId) => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected, cannot join group');
      return false;
    }

    socket.emit('join-group', groupId);
    return true;
  },

  // Quitter un groupe de discussion
  leaveGroup: (groupId) => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected, cannot leave group');
      return false;
    }

    socket.emit('leave-group', groupId);
    return true;
  },

  // Envoi d'un message privé
  sendPrivateMessage: (messageData) => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected, cannot send private message');
      return false;
    }

    console.log('Emitting private message via socket:', messageData);
    
    // Ajouter un timestamp s'il n'existe pas déjà
    const dataToSend = {
      ...messageData,
      timestamp: messageData.timestamp || Date.now()
    };
    
    socket.emit('private-message', dataToSend);
    return true;
  },

  // Envoi d'un message de groupe
  sendGroupMessage: (messageData) => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected, cannot send group message');
      return false;
    }

    console.log('Emitting group message via socket:', messageData);
    
    // Ajouter un timestamp s'il n'existe pas déjà
    const dataToSend = {
      ...messageData,
      timestamp: messageData.timestamp || Date.now()
    };
    
    socket.emit('group-message', dataToSend);
    return true;
  },

  // Envoi d'un indicateur de frappe
  sendTypingIndicator: (data) => {
    if (!socket || !socket.connected) {
      return false;
    }

    socket.emit('typing', data);
    return true;
  },

  // Rejoindre tous les groupes donnés
  joinGroups: (groups) => {
    if (!socket || !socket.connected || !Array.isArray(groups)) {
      return false;
    }

    groups.forEach(group => {
      if (group && group.id) {
        socket.emit('join-group', group.id);
      }
    });
    return true;
  }
};

export default socketService;
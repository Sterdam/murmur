// client/src/services/socket.js
import { io } from 'socket.io-client';
import envConfig from '../config/env';

// Singleton pour le socket
let socket = null;

// Fonction utilitaire pour normaliser les IDs de conversation
const normalizeConversationId = (id) => {
  if (!id) return id;
  
  // Si c'est un ID de groupe, le laisser tel quel
  if (id.startsWith('group:')) return id;
  
  // Si c'est un ID de conversation directe au format "id1:id2", tri des IDs
  if (id.includes(':')) {
    const parts = id.split(':');
    if (parts.length === 2) {
      return parts.sort().join(':');
    }
  }
  
  // Format inconnu (UUID, etc.), retourner tel quel
  return id;
};

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
      const socketUrl = process.env.REACT_APP_SOCKET_URL || envConfig.socketUrl || 'http://localhost:5000';
      const socketPath = envConfig.socketPath || '/socket.io';
      
      console.log(`Connecting to socket server: ${socketUrl}, path: ${socketPath}`);

      // Création de la connexion socket
      socket = io(socketUrl, {
        auth: { token },
        path: socketPath,
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
        if (data && messageHandler) {
          messageHandler(data);
        }
      });
    }
    
    if (groupMessageHandler) {
      socket.on('group-message', (data) => {
        console.log('Socket received group message:', data);
        if (data && groupMessageHandler) {
          groupMessageHandler(data);
        }
      });
    }
    
    if (deliveryHandler) {
      socket.on('message-delivered', (data) => {
        console.log('Socket received delivery confirmation:', data);
        if (data && deliveryHandler) {
          deliveryHandler(data);
        }
      });
    }
    
    if (typingHandler) {
      socket.on('typing', (data) => {
        if (data && typingHandler) {
          typingHandler(data);
        }
      });
    }

    return true;
  },

  // Joindre un groupe de discussion
  joinGroup: (groupId) => {
    if (!socket || !socket.connected || !groupId) {
      console.error('Socket not connected or groupId missing, cannot join group');
      return false;
    }

    socket.emit('join-group', groupId);
    return true;
  },

  // Quitter un groupe de discussion
  leaveGroup: (groupId) => {
    if (!socket || !socket.connected || !groupId) {
      console.error('Socket not connected or groupId missing, cannot leave group');
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
    
    if (!messageData || !messageData.recipientId) {
      console.error('Invalid message data for private message:', messageData);
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
    
    if (!messageData || !messageData.groupId) {
      console.error('Invalid message data for group message:', messageData);
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
    if (!socket || !socket.connected || !data || !data.conversationId) {
      return false;
    }
    
    // Normaliser l'ID de conversation
    const normalizedData = {
      ...data,
      conversationId: normalizeConversationId(data.conversationId)
    };

    socket.emit('typing', normalizedData);
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
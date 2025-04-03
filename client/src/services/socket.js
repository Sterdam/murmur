// client/src/services/socket.js - Optimisé et corrigé
import { io } from 'socket.io-client';
import envConfig from '../config/env';
import { getStoreState } from '../store';

// Singleton pour le socket
let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 3000; // 3 secondes

// Gestionnaires d'événements
let messageHandlers = {
  privateMessage: null,
  groupMessage: null,
  messageDelivered: null,
  typing: null,
  error: console.error
};

// Liste des messages en attente pour réessayer leur envoi
let pendingMessages = [];

// Map des rooms jointes pour éviter de les rejoindre plusieurs fois
const joinedRooms = new Set();

// Fonction utilitaire pour normaliser les IDs de conversation
const normalizeConversationId = (id) => {
  if (!id) return id;
  
  // Si c'est un ID de groupe, le laisser tel quel
  if (typeof id === 'string' && id.startsWith('group:')) return id;
  
  // Si c'est un ID de conversation directe au format "id1:id2", tri des IDs
  if (typeof id === 'string' && id.includes(':')) {
    const parts = id.split(':').filter(Boolean);
    if (parts.length === 2) {
      return parts.sort().join(':');
    }
  }
  
  // Format inconnu, retourner tel quel
  return id;
};

// Debounce pour limiter la fréquence des événements
const debounce = (func, wait) => {
  let timeout;
  return function(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Service socket optimisé avec gestion des reconnexions et meilleure gestion des erreurs
const socketService = {
  connect: (token) => {
    return new Promise((resolve, reject) => {
      try {
        if (!token) {
          console.error('[Socket] Erreur: Token d\'authentification manquant');
          return resolve(false);
        }

        // Si un socket existe déjà, le déconnecter proprement d'abord
        if (socket) {
          console.log('[Socket] Socket existant trouvé, déconnexion préalable...');
          socket.disconnect();
          socket = null;
        }

        // Réinitialiser le compteur de tentatives
        reconnectAttempts = 0;
        
        // Nettoyer tout timer de reconnexion existant
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Détermination de l'URL du socket basée sur l'environnement
        const socketUrl = process.env.REACT_APP_SOCKET_URL || envConfig.socketUrl || 'http://localhost:5000';
        const socketPath = envConfig.socketPath || '/socket.io';
        
        console.log(`[Socket] Connexion au serveur: ${socketUrl}, path: ${socketPath}`);

        // Création de la connexion socket avec configuration robuste
        socket = io(socketUrl, {
          auth: { token },
          path: socketPath,
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          withCredentials: true,
          autoConnect: true
        });

        // Définir un délai pour la connexion
        const connectionTimeout = setTimeout(() => {
          if (socket && !socket.connected) {
            console.error('[Socket] Délai de connexion dépassé');
            socket.disconnect();
            resolve(false);
          }
        }, 10000); // 10 secondes de délai

        // Configuration des événements de base
        socket.on('connect', () => {
          console.log('[Socket] Connexion établie avec succès, socket.id =', socket.id);
          // Réinitialiser le compteur de tentatives à la reconnexion réussie
          reconnectAttempts = 0;
          clearTimeout(connectionTimeout);
          
          // Vider la liste des rooms jointes (pour les rejoindre à nouveau)
          joinedRooms.clear();
          
          // Retransmettre les messages en attente
          socketService.retrySendingPendingMessages();
          
          resolve(true);
        });

        socket.on('disconnect', (reason) => {
          console.warn(`[Socket] Déconnecté: ${reason}, socket.id était ${socket.id}`);
          // Si la déconnexion n'est pas volontaire, tenter de se reconnecter
          if (reason === 'io server disconnect' || reason === 'transport close') {
            socketService.scheduleReconnect();
          }
        });

        socket.on('connect_error', (error) => {
          console.error('[Socket] Erreur de connexion:', error.message);
          socketService.scheduleReconnect();
          clearTimeout(connectionTimeout);
          resolve(false);
        });
        
        socket.on('error', (error) => {
          console.error('[Socket] Erreur reçue du serveur:', error);
          if (messageHandlers.error) {
            messageHandlers.error(error);
          }
        });
        
        // En cas d'échec de connexion sans événement d'erreur
        if (!socket) {
          clearTimeout(connectionTimeout);
          resolve(false);
        }
      } catch (error) {
        console.error('[Socket] Erreur lors de la connexion:', error);
        resolve(false);
      }
    });
  },
  
  // Planifier une tentative de reconnexion avec back-off exponentiel
  scheduleReconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    reconnectAttempts++;
    
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error('[Socket] Nombre maximum de tentatives de reconnexion atteint');
      return;
    }
    
    const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempts - 1), 30000);
    console.log(`[Socket] Tentative de reconnexion dans ${delay/1000} secondes...`);
    
    reconnectTimer = setTimeout(() => {
      console.log(`[Socket] Tentative de reconnexion #${reconnectAttempts}`);
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token);
      }
    }, delay);
  },

  // Déconnexion propre du serveur socket
  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('[Socket] Déconnecté manuellement');
      
      // Nettoyer les timers
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      // Vider la liste des rooms jointes
      joinedRooms.clear();
      
      return true;
    }
    return false;
  },

  // Vérification de la connexion
  isConnected: () => {
    return socket && socket.connected;
  },

  // Configuration des gestionnaires d'événements
  setupEventHandlers: (
    privateMessageHandler,
    groupMessageHandler,
    messageDeliveredHandler,
    typingHandler,
    errorHandler
  ) => {
    if (!socket) {
      console.error('[Socket] Socket non connecté, impossible de configurer les gestionnaires');
      return false;
    }

    console.log('[Socket] Configuration des gestionnaires d\'événements');

    // Enregistrer les gestionnaires dans l'objet
    messageHandlers = {
      privateMessage: privateMessageHandler,
      groupMessage: groupMessageHandler,
      messageDelivered: messageDeliveredHandler,
      typing: typingHandler,
      error: errorHandler || console.error
    };

    // Supprimer les anciens gestionnaires
    socket.off('private-message');
    socket.off('group-message');
    socket.off('message-delivered');
    socket.off('typing');
    socket.off('error');

    // Configurer les nouveaux gestionnaires avec validation des données
    if (privateMessageHandler) {
      socket.on('private-message', (data) => {
        try {
          console.log('[Socket] Message privé reçu:', data ? {
            senderId: data.senderId,
            senderUsername: data.senderUsername,
            conversationId: data.conversationId,
            messageId: data.id,
            hasEncryptedKey: !!data.encryptedKey
          } : 'invalid');
          
          if (data && data.senderId && data.message) {
            // Dernier contrôle pour éviter de traiter ses propres messages
            const state = getStoreState();
            const currentUserId = state?.auth?.user?.id;
            
            if (currentUserId && data.senderId === currentUserId) {
              console.log('[Socket] Message envoyé par l\'utilisateur actuel, ignoré');
              return;
            }
            
            privateMessageHandler(data);
          } else {
            console.warn('[Socket] Message privé reçu avec format invalide:', data);
          }
        } catch (error) {
          console.error('[Socket] Erreur dans le gestionnaire de message privé:', error);
        }
      });
    }
    
    if (groupMessageHandler) {
      socket.on('group-message', (data) => {
        try {
          console.log('[Socket] Message de groupe reçu:', data ? {
            senderId: data.senderId,
            senderUsername: data.senderUsername,
            groupId: data.groupId,
            messageId: data.id,
            hasEncryptedKeys: !!data.encryptedKeys
          } : 'invalid');
          
          if (data && data.senderId && data.groupId && data.message) {
            // Dernier contrôle pour éviter de traiter ses propres messages
            const state = getStoreState();
            const currentUserId = state?.auth?.user?.id;
            
            if (currentUserId && data.senderId === currentUserId) {
              console.log('[Socket] Message de groupe envoyé par l\'utilisateur actuel, ignoré');
              return;
            }
            
            groupMessageHandler(data);
          } else {
            console.warn('[Socket] Message de groupe reçu avec format invalide:', data);
          }
        } catch (error) {
          console.error('[Socket] Erreur dans le gestionnaire de message de groupe:', error);
        }
      });
    }
    
    if (messageDeliveredHandler) {
      socket.on('message-delivered', (data) => {
        try {
          console.log('[Socket] Confirmation de livraison reçue:', data);
          if (data && data.id) {
            messageDeliveredHandler(data);
          }
        } catch (error) {
          console.error('[Socket] Erreur dans le gestionnaire de confirmation de livraison:', error);
        }
      });
    }
    
    if (typingHandler) {
      // Utiliser un debounce pour les indicateurs de frappe
      const debouncedTypingHandler = debounce((data) => {
        try {
          if (data && data.senderId && data.conversationId) {
            typingHandler(data);
          }
        } catch (error) {
          console.error('[Socket] Erreur dans le gestionnaire d\'indicateur de frappe:', error);
        }
      }, 300);
      
      socket.on('typing', debouncedTypingHandler);
    }
    
    if (errorHandler) {
      socket.on('error', (error) => {
        try {
          console.error('[Socket] Erreur reçue:', error);
          errorHandler(error);
        } catch (err) {
          console.error('[Socket] Erreur dans le gestionnaire d\'erreur:', err);
        }
      });
    }

    return true;
  },

  // Joindre un groupe de discussion avec validation
  joinGroup: (groupId) => {
    if (!socket || !socket.connected) {
      console.warn('[Socket] Socket non connecté, impossible de rejoindre le groupe');
      return false;
    }
    
    if (!groupId) {
      console.error('[Socket] ID de groupe manquant');
      return false;
    }

    // Éviter de rejoindre la même room plusieurs fois
    const roomKey = `group:${groupId}`;
    if (joinedRooms.has(roomKey)) {
      console.log(`[Socket] Groupe ${groupId} déjà rejoint`);
      return true;
    }

    console.log(`[Socket] Rejoindre le groupe: ${groupId}`);
    socket.emit('join-group', groupId);
    joinedRooms.add(roomKey);
    return true;
  },

  // Quitter un groupe de discussion
  leaveGroup: (groupId) => {
    if (!socket || !socket.connected || !groupId) {
      return false;
    }

    console.log(`[Socket] Quitter le groupe: ${groupId}`);
    socket.emit('leave-group', groupId);
    joinedRooms.delete(`group:${groupId}`);
    return true;
  },

  // Ajout d'un message à la liste d'attente pour réessai
  addPendingMessage: (messageData) => {
    pendingMessages.push({
      type: messageData.groupId ? 'group' : 'private',
      data: messageData,
      timestamp: Date.now()
    });
    console.log(`[Socket] Message ajouté à la file d'attente. Total en attente: ${pendingMessages.length}`);
  },
  
  // Réessayer d'envoyer les messages en attente
  retrySendingPendingMessages: () => {
    if (!socket || !socket.connected || pendingMessages.length === 0) return;
    
    console.log(`[Socket] Tentative d'envoi de ${pendingMessages.length} messages en attente`);
    
    // Copier la liste pour éviter les problèmes lors de la modification
    const messagesToSend = [...pendingMessages];
    pendingMessages = [];
    
    // Envoyer les messages avec un petit délai entre chaque envoi
    messagesToSend.forEach((pendingMessage, index) => {
      setTimeout(() => {
        try {
          if (socket && socket.connected) {
            if (pendingMessage.type === 'group') {
              socket.emit('group-message', pendingMessage.data);
              console.log(`[Socket] Message de groupe en attente envoyé: ${pendingMessage.data.groupId}`);
            } else {
              socket.emit('private-message', pendingMessage.data);
              console.log(`[Socket] Message privé en attente envoyé: ${pendingMessage.data.recipientId}`);
            }
          } else {
            // Si nous avons perdu la connexion, remettre le message en file d'attente
            pendingMessages.push(pendingMessage);
          }
        } catch (error) {
          console.error('[Socket] Erreur lors de la réémission d\'un message:', error);
          pendingMessages.push(pendingMessage);
        }
      }, index * 300); // 300ms de délai entre chaque message
    });
  },

  // Envoi d'un message privé avec validation et gestion d'erreur
  sendPrivateMessage: (messageData) => {
    if (!socket || !socket.connected) {
      console.warn('[Socket] Socket non connecté, mise en file d\'attente du message privé');
      socketService.addPendingMessage(messageData);
      return false;
    }
    
    if (!messageData || !messageData.recipientId || !messageData.message) {
      console.error('[Socket] Données de message invalides pour message privé:', messageData);
      return false;
    }

    try {
      console.log('[Socket] Émission de message privé:', {
        recipientId: messageData.recipientId,
        hasMessage: !!messageData.message,
        hasEncryptedKey: !!messageData.encryptedKey
      });
      
      // Valider et compléter les données
      const dataToSend = {
        ...messageData,
        timestamp: messageData.timestamp || Date.now()
      };
      
      // S'assurer que la propriété conversationId est correctement définie
      if (!dataToSend.conversationId && dataToSend.recipientId) {
        const state = getStoreState();
        const currentUserId = state?.auth?.user?.id;
        
        if (currentUserId) {
          dataToSend.conversationId = [currentUserId, dataToSend.recipientId].sort().join(':');
          console.log(`[Socket] ID de conversation ajouté: ${dataToSend.conversationId}`);
        }
      }
      
      socket.emit('private-message', dataToSend);
      return true;
    } catch (error) {
      console.error('[Socket] Erreur lors de l\'envoi d\'un message privé:', error);
      socketService.addPendingMessage(messageData);
      return false;
    }
  },

  // Envoi d'un message de groupe avec validation et gestion d'erreur
  sendGroupMessage: (messageData) => {
    if (!socket || !socket.connected) {
      console.warn('[Socket] Socket non connecté, mise en file d\'attente du message de groupe');
      socketService.addPendingMessage(messageData);
      return false;
    }
    
    if (!messageData || !messageData.groupId || !messageData.message) {
      console.error('[Socket] Données de message invalides pour message de groupe:', messageData);
      return false;
    }

    try {
      console.log('[Socket] Émission de message de groupe:', {
        groupId: messageData.groupId,
        hasMessage: !!messageData.message,
        hasEncryptedKeys: !!messageData.encryptedKeys,
        keysCount: messageData.encryptedKeys ? Object.keys(messageData.encryptedKeys).length : 0
      });
      
      // Valider et compléter les données
      const dataToSend = {
        ...messageData,
        timestamp: messageData.timestamp || Date.now()
      };
      
      // S'assurer que la propriété conversationId est correctement définie
      if (!dataToSend.conversationId && dataToSend.groupId) {
        dataToSend.conversationId = `group:${dataToSend.groupId}`;
        console.log(`[Socket] ID de conversation ajouté: ${dataToSend.conversationId}`);
      }
      
      // Rejoindre le groupe si ce n'est pas déjà fait
      socketService.joinGroup(messageData.groupId);
      
      socket.emit('group-message', dataToSend);
      return true;
    } catch (error) {
      console.error('[Socket] Erreur lors de l\'envoi d\'un message de groupe:', error);
      socketService.addPendingMessage(messageData);
      return false;
    }
  },

  // Envoi d'un indicateur de frappe, limité par debounce
  sendTypingIndicator: debounce((data) => {
    if (!socket || !socket.connected || !data || !data.conversationId) {
      return false;
    }
    
    try {
      // Normaliser l'ID de conversation
      const normalizedData = {
        ...data,
        conversationId: normalizeConversationId(data.conversationId)
      };

      socket.emit('typing', normalizedData);
      return true;
    } catch (error) {
      console.error('[Socket] Erreur lors de l\'envoi d\'un indicateur de frappe:', error);
      return false;
    }
  }, 500), // Limiter à une émission tous les 500ms

  // Rejoindre tous les groupes donnés
  joinGroups: (groups) => {
    if (!socket || !socket.connected || !Array.isArray(groups)) {
      console.warn('[Socket] Impossible de rejoindre les groupes, socket non connecté ou groupes invalides');
      return false;
    }

    try {
      let joinedCount = 0;
      groups.forEach(group => {
        if (group && group.id) {
          const success = socketService.joinGroup(group.id);
          if (success) joinedCount++;
        }
      });
      console.log(`[Socket] ${joinedCount} groupes rejoints`);
      return true;
    } catch (error) {
      console.error('[Socket] Erreur lors de la jonction des groupes:', error);
      return false;
    }
  },
  
  // Marquer un message comme lu
  markMessageAsRead: (messageId, conversationId) => {
    if (!socket || !socket.connected || !messageId || !conversationId) {
      return false;
    }
    
    try {
      socket.emit('mark-as-read', {
        messageId,
        conversationId: normalizeConversationId(conversationId),
        timestamp: Date.now()
      });
      return true;
    } catch (error) {
      console.error('[Socket] Erreur lors du marquage du message comme lu:', error);
      return false;
    }
  }
};

export default socketService;
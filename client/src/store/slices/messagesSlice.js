// client/src/store/slices/messagesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import socketService from '../../services/socket';
import { encryptMessage, decryptMessage, encryptGroupMessage } from '../../services/encryption';
import { storeOfflineMessage, syncOfflineMessages, cacheOfflineData } from '../../utils/offlineSync';
import { getEncryptionKeys } from '../../utils/storage';

// Fonction utilitaire pour normaliser les ID de conversation
export const normalizeConversationId = (id) => {
  if (!id) return id;
  
  // Si c'est un ID de groupe, le laisser tel quel
  if (typeof id === 'string' && id.startsWith('group:')) return id;
  
  // Si c'est un ID direct, trier les parties
  if (typeof id === 'string' && id.includes(':')) {
    const parts = id.split(':').filter(Boolean);
    if (parts.length === 2) {
      return parts.sort().join(':');
    }
  }
  
  // Format inconnu, retourner tel quel
  return id;
};

// Async thunks
export const fetchConversationMessages = createAsyncThunk(
  'messages/fetchMessages',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      if (!conversationId) {
        return rejectWithValue('ID de conversation manquant');
      }
      
      // Normaliser l'ID de conversation avant toute opération
      const normalizedId = normalizeConversationId(conversationId);
      console.log(`Fetching messages for: ${conversationId} → normalized to: ${normalizedId}`);
      
      // Vérifier si nous sommes déjà en train de charger cette conversation
      const state = getState();
      if (state.messages.loading && state.messages.loadingConversationId === normalizedId) {
        console.log(`Skipping fetchConversationMessages - loading in progress for ${normalizedId}`);
        // Retourner les messages actuels plutôt que de déclencher une nouvelle requête
        return {
          conversationId: normalizedId,
          messages: state.messages.conversations[normalizedId] || [],
        };
      }
      
      // Vérifier si on a déjà des messages pour cette conversation
      const existingMessages = state.messages.conversations[normalizedId] || [];
      
      // Ajouter un délai entre les requêtes pour éviter de surcharger le serveur
      const lastFetchTime = state.messages.lastFetchTime || 0;
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      
      // Si moins de 2 secondes se sont écoulées depuis la dernière requête et que nous avons des messages
      // retourner les messages existants plutôt que de faire une nouvelle requête
      if (timeSinceLastFetch < 2000 && existingMessages.length > 0) {
        console.log(`Using cached messages - too soon since last fetch (${timeSinceLastFetch}ms)`);
        return {
          conversationId: normalizedId,
          messages: existingMessages,
        };
      }
      
      try {
        // Utiliser l'ID normalisé pour l'API
        const response = await api.get(`/messages/${normalizedId}`);
        
        // Vérifier la structure de la réponse
        if (!response.data || !response.data.success) {
          throw new Error('Format de réponse API invalide');
        }
        
        const messages = response.data.data || [];
        console.log(`Received ${messages.length} messages from API for conversation: ${normalizedId}`);
        
        // État courant et clés de déchiffrement
        const currentUser = state.auth.user;
        
        // Obtenir les clés de chiffrement du stockage local
        const keys = getEncryptionKeys();
        const privateKey = keys?.privateKey || state.auth.privateKey;
        
        if (!privateKey) {
          console.warn('Private key not available for decryption');
        }
        
        // Déchiffrer les messages avec gestion d'erreur robuste
        const decryptedMessages = await Promise.all(
          messages.map(async (message) => {
            // Validation de base
            if (!message) {
              console.warn('Received null or undefined message');
              return null;
            }
            
            // Si l'utilisateur est l'expéditeur, pas besoin de déchiffrer
            if (message.senderId === currentUser?.id) {
              return {
                ...message,
                conversationId: normalizedId, // Normaliser l'ID de conversation
              };
            }
            
            try {
              let decryptedText = null;
              
              // Cas de message direct
              if (message.encryptedKey && privateKey) {
                const metadata = message.metadata || '{}';
                
                decryptedText = await decryptMessage(
                  message.message,
                  message.encryptedKey,
                  privateKey,
                  null,
                  null,
                  metadata
                );
              } 
              // Cas de message de groupe
              else if (message.encryptedKeys && privateKey && currentUser?.id) {
                // Récupérer la clé chiffrée pour cet utilisateur
                const userEncryptedKey = message.encryptedKeys[currentUser.id];
                const metadata = message.metadata || '{}';
                
                if (userEncryptedKey) {
                  decryptedText = await decryptMessage(
                    message.message,
                    userEncryptedKey,
                    privateKey,
                    null,
                    null,
                    metadata
                  );
                }
              }
              
              // Si le déchiffrement a échoué ou n'était pas possible
              if (!decryptedText) {
                return {
                  ...message,
                  message: '[Message chiffré - Impossible de déchiffrer]',
                  conversationId: normalizedId,
                  encryptionFailed: true
                };
              }
              
              return {
                ...message,
                message: decryptedText,
                conversationId: normalizedId,
                encryptionFailed: false
              };
            } catch (error) {
              console.error('Failed to decrypt message:', error, message);
              return {
                ...message,
                message: '[Message chiffré - Échec du déchiffrement]',
                conversationId: normalizedId,
                encryptionFailed: true
              };
            }
          })
        );
        
        // Filtrer les messages nuls ou indéfinis
        const validMessages = decryptedMessages.filter(msg => msg !== null);
        
        console.log(`Successfully processed ${validMessages.length} messages for conversation: ${normalizedId}`);
        
        // Mettre en cache les messages pour l'utilisation hors ligne
        cacheOfflineData('messages', validMessages).catch(err => {
          console.warn('Failed to cache messages for offline use:', err);
        });
        
        return {
          conversationId: normalizedId,
          messages: validMessages,
          lastFetchTime: Date.now(),
        };
      } catch (error) {
        // Cas d'erreur 429 (trop de requêtes)
        if (error.response?.status === 429 && existingMessages.length > 0) {
          console.warn('Rate limited while fetching messages, using existing data');
          return {
            conversationId: normalizedId,
            messages: existingMessages,
          };
        }
        
        // En cas d'erreur 403 (accès refusé), gérer spécifiquement
        if (error.response?.status === 403) {
          console.error(`Unauthorized access to conversation: ${normalizedId}`);
          return rejectWithValue('Accès non autorisé à cette conversation');
        }
        
        // Erreur réseau
        if (error.message === 'Network Error' && existingMessages.length > 0) {
          console.warn('Network error while fetching messages, using existing data');
          return {
            conversationId: normalizedId,
            messages: existingMessages,
          };
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Échec du chargement des messages'
      );
    }
  }
);


export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async ({ recipientId, groupId, message, conversationId }, { rejectWithValue, getState }) => {
    try {
      // Validation des paramètres
      if (!message || (!recipientId && !groupId)) {
        return rejectWithValue('Paramètres de message invalides');
      }
      
      console.log('Sending message:', { 
        recipientId, 
        groupId, 
        messageLength: message?.length,
        conversationId
      });
      
      const currentUser = getState().auth.user;
      const contacts = getState().contacts.contacts;
      const groups = getState().groups.groups;
      
      if (!currentUser || !currentUser.id) {
        return rejectWithValue('Utilisateur non authentifié');
      }
      
      // Obtenir les clés de chiffrement du stockage local
      const keys = getEncryptionKeys();
      if (!keys) {
        return rejectWithValue('Clés de chiffrement non disponibles');
      }
      
      // Normaliser l'ID de conversation
      const normalizedId = normalizeConversationId(conversationId);
      let encryptedData;
      
      // Message direct
      if (recipientId) {
        // Trouver la clé publique du destinataire
        const recipient = contacts.find(
          (contact) => contact.id === recipientId
        );
        
        if (!recipient) {
          console.error('Recipient not found in contacts:', recipientId);
          return rejectWithValue('Destinataire introuvable dans vos contacts');
        }
        
        if (!recipient.publicKey) {
          console.error('Recipient public key not available:', recipient);
          return rejectWithValue('Clé publique du destinataire non disponible - Vous devez être contacts connectés pour échanger des messages');
        }
        
        console.log('Encrypting message for recipient:', recipient.username);
        try {
          encryptedData = await encryptMessage(message, recipient.publicKey);
          console.log('Message encrypted successfully');
        } catch (err) {
          console.error('Encryption error:', err);
          return rejectWithValue('Échec du chiffrement du message: ' + err.message);
        }
        
        const messagePayload = {
          recipientId,
          message: encryptedData.encryptedMessage,
          encryptedKey: encryptedData.encryptedKey,
          metadata: encryptedData.metadata
        };
        
        console.log('Message payload prepared for direct message');
        
        // Essayer d'envoyer via socket d'abord
        if (socketService.isConnected()) {
          console.log('Socket connected, sending message via socket');
          socketService.sendPrivateMessage(messagePayload);
        } else {
          console.log('Socket not connected, saving for offline sync');
          // Sauvegarder pour synchronisation quand connexion rétablie
          await storeOfflineMessage(messagePayload);
          
          // Essayer de synchroniser immédiatement
          syncOfflineMessages().catch(err => {
            console.warn('Failed to sync offline messages:', err);
          });
        }
        
        // Créer un ID de message unique
        const msgId = Date.now().toString() + Math.floor(Math.random() * 1000);
        console.log('Generated message ID:', msgId);
        
        // Retourner le message pour mise à jour dans le store Redux
        return {
          id: msgId,
          senderId: currentUser.id,
          senderUsername: currentUser.username,
          recipientId,
          message, // Message original pour affichage
          timestamp: Date.now(),
          conversationId: normalizedId,
          status: socketService.isConnected() ? 'sent' : 'pending',
        };
      } 
      // Message de groupe
      else if (groupId) {
        console.log('Sending group message to group:', groupId);
        // Trouver le groupe
        const group = groups.find((g) => g.id === groupId);
        
        if (!group) {
          console.error('Group not found:', groupId);
          return rejectWithValue('Groupe introuvable');
        }
        
        console.log('Group found:', group.name, 'with members:', group.members?.length || 0);
        
        if (!group.members || !Array.isArray(group.members) || group.members.length === 0) {
          return rejectWithValue('Aucun membre dans ce groupe');
        }
        
        // Collecter les clés publiques de tous les membres (sauf soi-même)
        const membersPublicKeys = [];
        const membersWithKeys = {};
        
        for (const memberId of group.members) {
          if (memberId === currentUser.id) continue; // Ignorer soi-même
          
          const member = contacts.find(contact => contact.id === memberId);
          
          if (member && member.publicKey) {
            membersPublicKeys.push(member.publicKey);
            membersWithKeys[memberId] = member.publicKey;
          } else {
            console.log(`Member ${memberId} has no public key available`);
          }
        }
        
        if (membersPublicKeys.length === 0) {
          console.error('No members with public keys found in the group');
          return rejectWithValue('Aucun membre avec clé publique trouvé dans le groupe');
        }
        
        console.log(`Found ${membersPublicKeys.length} members with public keys`);
        
        try {
          // Utiliser la fonction optimisée pour le chiffrement de groupe
          encryptedData = await encryptGroupMessage(message, membersPublicKeys);
          console.log('Group message encrypted successfully');
        } catch (err) {
          console.error('Group encryption error:', err);
          return rejectWithValue('Échec du chiffrement du message de groupe: ' + err.message);
        }
        
        const groupMessagePayload = {
          groupId,
          message: encryptedData.encryptedMessage,
          encryptedKeys: encryptedData.encryptedKeys,
          metadata: encryptedData.metadata
        };
        
        console.log('Group message payload prepared');
        
        // Essayer d'envoyer via socket d'abord
        if (socketService.isConnected()) {
          console.log('Socket connected, sending group message via socket');
          socketService.sendGroupMessage(groupMessagePayload);
        } else {
          console.log('Socket not connected, saving group message for offline sync');
          // Sauvegarder pour synchronisation quand connexion rétablie
          await storeOfflineMessage(groupMessagePayload);
          
          // Essayer de synchroniser immédiatement
          syncOfflineMessages().catch(err => {
            console.warn('Failed to sync offline messages:', err);
          });
        }
        
        // Créer un ID de message unique
        const msgId = Date.now().toString() + Math.floor(Math.random() * 1000);
        
        // Retourner le message pour mise à jour dans le store Redux
        return {
          id: msgId,
          senderId: currentUser.id,
          senderUsername: currentUser.username,
          groupId,
          message, // Message original pour affichage
          timestamp: Date.now(),
          conversationId: `group:${groupId}`,
          status: socketService.isConnected() ? 'sent' : 'pending',
        };
      }
      
      return rejectWithValue('Configuration de message invalide');
    } catch (error) {
      console.error('Send message error:', error);
      return rejectWithValue(error.message || 'Échec de l\'envoi du message');
    }
  }
);

const initialState = {
  conversations: {},
  activeConversation: null,
  loading: false,
  loadingConversationId: null,
  error: null,
  lastFetchTime: 0,
  fetchCount: 0,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversation = action.payload ? normalizeConversationId(action.payload) : null;
    },
    addMessage: (state, action) => {
      const { message } = action.payload;
      if (!message || !message.conversationId) {
        console.error('Invalid message object:', message);
        return;
      }
      
      // Normaliser l'ID de conversation
      const conversationId = normalizeConversationId(message.conversationId);
      
      // Initialiser la conversation si elle n'existe pas encore
      if (!state.conversations[conversationId]) {
        state.conversations[conversationId] = [];
      }
      
      // Vérifier si le message existe déjà pour éviter les doublons
      const messageExists = state.conversations[conversationId].some(
        (msg) => msg.id === message.id
      );
      
      if (!messageExists) {
        state.conversations[conversationId].push(message);
        
        // Trier les messages par timestamp
        state.conversations[conversationId].sort((a, b) => {
          const timestampA = a.timestamp || 0;
          const timestampB = b.timestamp || 0;
          return timestampA - timestampB;
        });
      }
    },
    updateMessageStatus: (state, action) => {
      const { messageId, conversationId, status } = action.payload;
      if (!messageId || !conversationId || !status) {
        return;
      }
      
      // Normaliser l'ID de conversation
      const normalizedId = normalizeConversationId(conversationId);
      
      if (state.conversations[normalizedId]) {
        const messageIndex = state.conversations[normalizedId].findIndex(
          (msg) => msg.id === messageId
        );
        
        if (messageIndex !== -1) {
          state.conversations[normalizedId][messageIndex].status = status;
        }
      }
    },
    clearMessageError: (state) => {
      state.error = null;
    },
    markConversationAsRead: (state, action) => {
      const conversationId = normalizeConversationId(action.payload.conversationId);
      const userId = action.payload.userId;
      
      if (state.conversations[conversationId] && userId) {
        state.conversations[conversationId].forEach(message => {
          if (!message.isRead && message.senderId !== userId) {
            message.isRead = true;
          }
        });
      }
    },
    // Récupère les conversations locales quand l'application démarre
    hydrateConversations: (state, action) => {
      if (action.payload && typeof action.payload === 'object') {
        // Normaliser toutes les clés de conversation
        const normalizedConversations = {};
        Object.keys(action.payload).forEach(convId => {
          const normalizedId = normalizeConversationId(convId);
          normalizedConversations[normalizedId] = action.payload[convId];
        });
        
        state.conversations = normalizedConversations;
      }
    },
    // Nettoie une conversation spécifique
    clearConversation: (state, action) => {
      const conversationId = normalizeConversationId(action.payload);
      
      if (state.conversations[conversationId]) {
        delete state.conversations[conversationId];
      }
    },
    // Nettoie toutes les conversations
    clearAllConversations: (state) => {
      state.conversations = {};
      state.activeConversation = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Messages
      .addCase(fetchConversationMessages.pending, (state, action) => {
        state.loading = true;
        state.loadingConversationId = normalizeConversationId(action.meta.arg);
        state.error = null;
      })
      .addCase(fetchConversationMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingConversationId = null;
        
        // Vérification de la validité de la payload
        if (action.payload && action.payload.conversationId && Array.isArray(action.payload.messages)) {
          // Normaliser l'ID de conversation
          const conversationId = normalizeConversationId(action.payload.conversationId);
          
          // Fusionner les messages existants et nouveaux
          const existingMessages = state.conversations[conversationId] || [];
          const newMessages = action.payload.messages;
          
          // Créer un Map pour éliminer les doublons efficacement
          const messageMap = new Map();
          
          // Ajouter les messages existants au Map
          existingMessages.forEach(msg => {
            if (msg && msg.id) {
              messageMap.set(msg.id, msg);
            }
          });
          
          // Ajouter ou remplacer par les nouveaux messages
          newMessages.forEach(msg => {
            if (msg && msg.id) {
              messageMap.set(msg.id, msg);
            }
          });
          
          // Convertir le Map en array et trier par timestamp
          const mergedMessages = Array.from(messageMap.values())
            .sort((a, b) => {
              const timestampA = a.timestamp || 0;
              const timestampB = b.timestamp || 0;
              return timestampA - timestampB;
            });
          
          // Mettre à jour la conversation
          state.conversations[conversationId] = mergedMessages;
          
          // Mettre à jour le temps de dernière requête
          if (action.payload.lastFetchTime) {
            state.lastFetchTime = action.payload.lastFetchTime;
          } else {
            state.lastFetchTime = Date.now();
          }
          
          // Incrémenter le compteur de requêtes
          state.fetchCount += 1;
          
          console.log(`Updated messages for conversation ${conversationId}, count: ${mergedMessages.length}, total fetches: ${state.fetchCount}`);
        } else {
          console.error('Invalid payload format in fetchConversationMessages.fulfilled:', action.payload);
        }
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.loading = false;
        state.loadingConversationId = null;
        state.error = action.payload || 'Échec du chargement des messages';
        console.error('Failed to fetch messages:', action.payload);
      })
      
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        
        if (!message || !message.conversationId) {
          console.error('Invalid message payload in sendMessage.fulfilled:', message);
          return;
        }
        
        // Normaliser l'ID de conversation
        const conversationId = normalizeConversationId(message.conversationId);
        
        // Initialiser la conversation si elle n'existe pas encore
        if (!state.conversations[conversationId]) {
          state.conversations[conversationId] = [];
        }
        
        // Vérifier si le message existe déjà pour éviter les doublons
        const messageExists = state.conversations[conversationId].some(
          (msg) => msg.id === message.id
        );
        
        if (!messageExists) {
          state.conversations[conversationId].push(message);
          
          // Trier par timestamp
          state.conversations[conversationId].sort((a, b) => {
            const timestampA = a.timestamp || 0;
            const timestampB = b.timestamp || 0;
            return timestampA - timestampB;
          });
          
          console.log(`Message added to conversation ${conversationId}, new count:`, 
            state.conversations[conversationId].length);
        } else {
          console.log(`Message ${message.id} already exists in conversation ${conversationId}`);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.payload || 'Échec de l\'envoi du message';
      });
  },
});

export const { 
  setActiveConversation, 
  addMessage, 
  updateMessageStatus, 
  clearMessageError,
  markConversationAsRead,
  hydrateConversations,
  clearConversation,
  clearAllConversations
} = messagesSlice.actions;

export default messagesSlice.reducer;
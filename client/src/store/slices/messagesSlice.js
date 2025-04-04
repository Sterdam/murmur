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
  
  // Si c'est un ID direct au format "id1:id2", trier les parties pour consistance
  if (typeof id === 'string' && id.includes(':')) {
    const parts = id.split(':').filter(Boolean);
    if (parts.length === 2) {
      return parts.sort().join(':');
    }
  }
  
  // Si c'est un UUID ou autre format non reconnu, le retourner tel quel
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
      
      // Éviter les requêtes multiples simultanées pour la même conversation
      const state = getState();
      
      // Vérifier si on a déjà des messages pour cette conversation
      const existingMessages = state.messages.conversations[normalizedId] || [];
      
      try {
        // Utiliser l'ID normalisé pour l'API
        const response = await api.get(`/messages/${normalizedId}`);
        
        // Vérifier la structure de la réponse
        if (!response.data || !response.data.success) {
          throw new Error('Format de réponse API invalide');
        }
        
        const messages = response.data.data || [];
        
        // État courant et clés de déchiffrement
        const currentUser = state.auth.user;
        
        // Obtenir les clés de chiffrement du stockage local
        const keys = getEncryptionKeys();
        const privateKey = keys?.privateKey || state.auth.privateKey;
        
        if (!privateKey) {
          throw new Error('Clé privée non disponible pour le déchiffrement');
        }
        
        // Déchiffrer les messages
        const decryptedMessages = await Promise.all(
          messages.map(async (message) => {
            // Validation de base
            if (!message) {
              return null;
            }
            
            // S'assurer que l'ID de conversation est normalisé
            const msgConversationId = normalizeConversationId(normalizedId);
            
            // Si l'utilisateur est l'expéditeur, pas besoin de déchiffrer
            if (message.senderId === currentUser?.id) {
              return {
                ...message,
                conversationId: msgConversationId,
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
                  conversationId: msgConversationId,
                  encryptionFailed: true
                };
              }
              
              return {
                ...message,
                message: decryptedText,
                conversationId: msgConversationId,
                encryptionFailed: false
              };
            } catch (error) {
              return {
                ...message,
                message: '[Message chiffré - Échec du déchiffrement]',
                conversationId: msgConversationId,
                encryptionFailed: true
              };
            }
          })
        );
        
        // Filtrer les messages nuls ou indéfinis
        const validMessages = decryptedMessages.filter(msg => msg !== null);
        
        // Mettre en cache les messages pour l'utilisation hors ligne
        cacheOfflineData('messages', validMessages).catch(() => {
          // Erreur silencieuse - ne pas bloquer le flux
        });
        
        return {
          conversationId: normalizedId,
          messages: validMessages,
          lastFetchTime: Date.now(),
        };
      } catch (error) {
        // Cas d'erreur 429 (trop de requêtes)
        if (error.response?.status === 429 && existingMessages.length > 0) {
          return {
            conversationId: normalizedId,
            messages: existingMessages,
          };
        }
        
        // En cas d'erreur 403 (accès refusé), gérer spécifiquement
        if (error.response?.status === 403) {
          return rejectWithValue('Accès non autorisé à cette conversation');
        }
        
        // Erreur réseau
        if (error.message === 'Network Error' && existingMessages.length > 0) {
          return {
            conversationId: normalizedId,
            messages: existingMessages,
          };
        }
        
        throw error;
      }
    } catch (error) {
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
          return rejectWithValue('Destinataire introuvable dans vos contacts');
        }
        
        if (!recipient.publicKey) {
          return rejectWithValue('Clé publique du destinataire non disponible - Vous devez être contacts connectés pour échanger des messages');
        }
        
        try {
          encryptedData = await encryptMessage(message, recipient.publicKey);
        } catch (err) {
          return rejectWithValue('Échec du chiffrement du message: ' + err.message);
        }
        
        const messagePayload = {
          recipientId,
          message: encryptedData.encryptedMessage,
          encryptedKey: encryptedData.encryptedKey,
          metadata: encryptedData.metadata
        };
        
        // Vérifier si le socket est vraiment connecté avant d'envoyer
        const socketConnected = socketService.isConnected();
        
        if (socketConnected) {
          const sent = socketService.sendPrivateMessage(messagePayload);
          if (!sent) {
            // Le message est déjà mis en file d'attente par socketService
          }
        } else {
          // Sauvegarder pour synchronisation quand connexion rétablie
          await storeOfflineMessage(messagePayload);
          
          // Essayer de synchroniser immédiatement
          syncOfflineMessages().catch(() => {
            // Erreur silencieuse - ne pas bloquer le flux
          });
        }
        
        // Créer un ID de message unique
        const msgId = Date.now().toString() + Math.floor(Math.random() * 1000);
        
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
        // Trouver le groupe
        const group = groups.find((g) => g.id === groupId);
        
        if (!group) {
          return rejectWithValue('Groupe introuvable');
        }
        
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
          }
        }
        
        if (membersPublicKeys.length === 0) {
          return rejectWithValue('Aucun membre avec clé publique trouvé dans le groupe');
        }
        
        try {
          // Utiliser la fonction optimisée pour le chiffrement de groupe
          encryptedData = await encryptGroupMessage(message, membersPublicKeys);
        } catch (err) {
          return rejectWithValue('Échec du chiffrement du message de groupe: ' + err.message);
        }
        
        const groupMessagePayload = {
          groupId,
          message: encryptedData.encryptedMessage,
          encryptedKeys: encryptedData.encryptedKeys,
          metadata: encryptedData.metadata
        };
        
        // Vérifier si le socket est vraiment connecté avant d'envoyer
        if (socketService.isConnected()) {
          const sent = socketService.sendGroupMessage(groupMessagePayload);
          if (!sent) {
            // Le message est déjà mis en file d'attente par socketService
          }
        } else {
          // Sauvegarder pour synchronisation quand connexion rétablie
          await storeOfflineMessage(groupMessagePayload);
          
          // Essayer de synchroniser immédiatement
          syncOfflineMessages().catch(() => {
            // Erreur silencieuse - ne pas bloquer le flux
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
        return;
      }
      
      // Normaliser l'ID de conversation
      const conversationId = normalizeConversationId(message.conversationId);
      
      // Initialiser la conversation si elle n'existe pas encore
      if (!state.conversations[conversationId]) {
        state.conversations[conversationId] = [];
      }
      
      // Vérifier si le message existe déjà pour éviter les doublons
      const existingMessageIndex = state.conversations[conversationId].findIndex(
        (msg) => msg.id === message.id
      );
      
      if (existingMessageIndex === -1) {
        // Le message n'existe pas encore, l'ajouter
        state.conversations[conversationId].push(message);
        
        // Trier les messages par timestamp
        state.conversations[conversationId].sort((a, b) => {
          const timestampA = a.timestamp || 0;
          const timestampB = b.timestamp || 0;
          return timestampA - timestampB;
        });
      } else {
        // Le message existe déjà, mise à jour si nécessaire
        state.conversations[conversationId][existingMessageIndex] = {
          ...state.conversations[conversationId][existingMessageIndex],
          ...message
        };
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
    updatePendingMessages: (state) => {
      // Parcourir toutes les conversations
      Object.keys(state.conversations).forEach(conversationId => {
        const messages = state.conversations[conversationId];
        
        // Mettre à jour le statut des messages en attente
        state.conversations[conversationId] = messages.map(message => {
          if (message.status === 'pending' && socketService.isConnected()) {
            return {
              ...message,
              status: 'sent'
            };
          }
          return message;
        });
      });
    },
    clearMessageError: (state) => {
      state.error = null;
    },
    markConversationAsRead: (state, action) => {
      const { conversationId, userId } = action.payload;
      if (!conversationId || !userId) return;
      
      const normalizedId = normalizeConversationId(conversationId);
      
      if (state.conversations[normalizedId]) {
        state.conversations[normalizedId].forEach(message => {
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
          
          // Initialiser si nécessaire
          if (!state.conversations[conversationId]) {
            state.conversations[conversationId] = [];
          }
          
          // Fusionner les messages existants et nouveaux
          const existingMessages = state.conversations[conversationId];
          const newMessages = action.payload.messages;
          
          // Créer un Map pour éliminer les doublons
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
          state.fetchCount = (state.fetchCount || 0) + 1;
        }
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.loading = false;
        state.loadingConversationId = null;
        state.error = action.payload || 'Échec du chargement des messages';
      })
      
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        
        if (!message || !message.conversationId) {
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
  clearAllConversations,
  updatePendingMessages
} = messagesSlice.actions;

export default messagesSlice.reducer;
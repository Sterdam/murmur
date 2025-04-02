// client/src/store/slices/messagesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import socketService from '../../services/socket';
import { encryptMessage, decryptMessage } from '../../services/encryption';
import { storeOfflineMessage, syncOfflineMessages } from '../../utils/offlineSync';

// Fonction utilitaire pour normaliser les ID de conversation
const normalizeConversationId = (id) => {
  if (!id) return id;
  
  // Si c'est un ID de groupe, le laisser tel quel
  if (id.startsWith('group:')) return id;
  
  // Si c'est un ID direct, trier les parties
  if (id.includes(':')) {
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
      
      // Vérifier si nous sommes déjà en train de charger cette conversation
      const state = getState();
      if (state.messages.loading) {
        console.log(`Skipping fetchConversationMessages - loading in progress`);
        // Retourner les messages actuels plutôt que de déclencher une nouvelle requête
        const normalizedId = normalizeConversationId(conversationId);
            
        return {
          conversationId: normalizedId,
          messages: state.messages.conversations[normalizedId] || [],
        };
      }
      
      console.log(`Fetching messages for conversation: ${conversationId}`);
      
      // Normaliser l'ID de conversation
      const normalizedId = normalizeConversationId(conversationId);
      
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
        const response = await api.get(`/messages/${normalizedId}`);
        
        // Vérifier la structure de la réponse
        if (!response.data || !response.data.success) {
          throw new Error('Format de réponse API invalide');
        }
        
        const messages = response.data.data || [];
        console.log(`Received ${messages.length} messages from API for conversation: ${normalizedId}`);
        
        // État courant et clés de déchiffrement
        const currentUser = state.auth.user;
        const privateKey = state.auth.privateKey;
        
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
              // Déchiffrer uniquement si on a les clés nécessaires
              if (!message.encryptedKey || !privateKey) {
                return {
                  ...message,
                  message: '[Message chiffré - Impossible de déchiffrer]',
                  conversationId: normalizedId,
                };
              }
              
              // Déchiffrement avec gestion des erreurs
              const metadata = message.metadata || '{}';
              
              const decrypted = await decryptMessage(
                message.message,
                message.encryptedKey,
                privateKey,
                null,
                null,
                metadata
              );
              
              return {
                ...message,
                message: decrypted,
                conversationId: normalizedId,
              };
            } catch (error) {
              console.error('Failed to decrypt message:', error, message);
              return {
                ...message,
                message: '[Message chiffré - Échec du déchiffrement]',
                conversationId: normalizedId,
              };
            }
          })
        );
        
        // Filtrer les messages nuls ou indéfinis
        const validMessages = decryptedMessages.filter(msg => msg !== null);
        
        console.log(`Successfully processed ${validMessages.length} messages for conversation: ${normalizedId}`);
        
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
      
      if (!currentUser || !currentUser.id) {
        return rejectWithValue('Utilisateur non authentifié');
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
          syncOfflineMessages();
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
        const group = getState().groups.groups.find((g) => g.id === groupId);
        
        if (!group) {
          console.error('Group not found:', groupId);
          return rejectWithValue('Groupe introuvable');
        }
        
        console.log('Group found:', group.name, 'with members:', group.members?.length || 0);
        
        // Chiffrer le message pour chaque membre du groupe
        const encryptedKeys = {};
        let anyKeysFound = false;
        
        if (!group.members || !Array.isArray(group.members) || group.members.length === 0) {
          return rejectWithValue('Aucun membre dans ce groupe');
        }
        
        // Parcourir tous les membres pour chiffrer le message pour chacun
        for (const memberId of group.members) {
          if (memberId === currentUser.id) {
            console.log('Skipping self for encryption:', memberId);
            continue; // Ignorer soi-même
          }
          
          const member = contacts.find(
            (contact) => contact.id === memberId
          );
          
          if (member && member.publicKey) {
            console.log('Found member with public key:', member.username);
            anyKeysFound = true;
            try {
              const encrypted = await encryptMessage(message, member.publicKey);
              encryptedKeys[memberId] = encrypted.encryptedKey;
              console.log('Successfully encrypted for member:', member.username);
            } catch (err) {
              console.error(`Failed to encrypt for member ${memberId}:`, err);
              // Continuer avec les autres membres
            }
          } else {
            console.log('Member missing or has no public key:', memberId);
          }
        }
        
        if (!anyKeysFound) {
          console.error('No valid recipients with public keys in the group');
          return rejectWithValue('Aucun destinataire valide avec clés publiques - Vous devez être connecté avec au moins un membre');
        }
        
        console.log(`Successfully encrypted for ${Object.keys(encryptedKeys).length} members`);
        
        // Utiliser le même message chiffré pour tous les destinataires (économie de bande passante)
        const firstContact = contacts.find(c => c.publicKey);
        if (!firstContact) {
          console.error('No contact with public key found for base encryption');
          return rejectWithValue('Impossible de trouver une clé publique valide pour le chiffrement');
        }
        
        encryptedData = await encryptMessage(message, firstContact.publicKey);
        
        const groupMessagePayload = {
          groupId,
          message: encryptedData.encryptedMessage,
          encryptedKeys,
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
          syncOfflineMessages();
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
  error: null,
  lastFetchTime: 0, // Pour suivre la dernière fois qu'une requête a été faite
  fetchCount: 0,    // Pour suivre le nombre de requêtes
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversation = action.payload;
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
      const conversationId = normalizeConversationId(action.payload);
      
      if (state.conversations[conversationId]) {
        state.conversations[conversationId].forEach(message => {
          if (!message.isRead && message.senderId !== action.payload.userId) {
            message.isRead = true;
          }
        });
      }
    },
    // Récupère les conversations locales quand l'application démarre
    hydrateConversations: (state, action) => {
      if (action.payload && typeof action.payload === 'object') {
        state.conversations = action.payload;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Messages
      .addCase(fetchConversationMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversationMessages.fulfilled, (state, action) => {
        state.loading = false;
        
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
  hydrateConversations
} = messagesSlice.actions;

export default messagesSlice.reducer;
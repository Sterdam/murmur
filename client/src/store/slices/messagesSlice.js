// client/src/store/slices/messagesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import socketService from '../../services/socket';
import { encryptMessage, decryptMessage } from '../../services/encryption';
import { storeOfflineMessage, syncOfflineMessages } from '../../utils/offlineSync';

// Async thunks
export const fetchConversationMessages = createAsyncThunk(
  'messages/fetchMessages',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      console.log(`Fetching messages for conversation: ${conversationId}`);
      
      // Vérifier si on a déjà des messages pour cette conversation
      const existingMessages = getState().messages.conversations[conversationId] || [];
      
      // Normaliser l'ID de conversation pour s'assurer qu'il est bien formaté
      let normalizedId = conversationId;
      
      // Si c'est un ID direct (format userId:userId), trier les IDs
      if (!conversationId.startsWith('group:') && conversationId.includes(':')) {
        const parts = conversationId.split(':');
        if (parts.length === 2) {
          normalizedId = parts.sort().join(':');
        }
      }
      
      try {
        const response = await api.get(`/messages/${normalizedId}`, {
          headers: {
            Authorization: `Bearer ${getState().auth.token}`,
          },
        });
        
        const messages = response.data.data || [];
        console.log(`Received ${messages.length} messages from API for conversation: ${normalizedId}`);
        
        const currentUser = getState().auth.user;
        const privateKey = getState().auth.privateKey;
        
        if (!privateKey) {
          console.warn('Private key not available for decryption');
        }
        
        // Decrypt messages avec gestion d'erreur robuste
        const decryptedMessages = await Promise.all(
          messages.map(async (message) => {
            if (!message) {
              console.warn('Received null or undefined message');
              return null;
            }
            
            if (message.senderId === currentUser.id) {
              // Sender (current user) doesn't need to decrypt
              return message;
            }
            
            try {
              if (!message.encryptedKey || !privateKey) {
                return {
                  ...message,
                  message: '[Encrypted message - Cannot decrypt]',
                };
              }
              
              const metadata = message.metadata || '{}'; // Valeur par défaut
              
              const decrypted = await decryptMessage(
                message.message,
                message.encryptedKey,
                privateKey,
                null,  // senderPublicKeyJson
                null,  // signature
                metadata
              );
              
              return {
                ...message,
                message: decrypted,
              };
            } catch (error) {
              console.error('Failed to decrypt message:', error, message);
              return {
                ...message,
                message: '[Encrypted message - Decryption failed]',
              };
            }
          })
        );
        
        // Filtrer les messages nuls ou indéfinis
        const validMessages = decryptedMessages.filter(msg => msg !== null);
        
        console.log(`Successfully processed ${validMessages.length} messages for conversation: ${normalizedId}`);
        
        return {
          conversationId,
          messages: validMessages,
        };
      } catch (error) {
        // Cas d'erreur 429 (trop de requêtes)
        if (error.response?.status === 429 && existingMessages.length > 0) {
          console.warn('Rate limited while fetching messages, using existing data');
          return {
            conversationId,
            messages: existingMessages,
          };
        }
        
        // En cas d'erreur 403 (accès refusé), gérer spécifiquement cette erreur
        if (error.response?.status === 403) {
          console.error(`Unauthorized access to conversation: ${normalizedId}`);
          return rejectWithValue('Unauthorized access to conversation');
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async ({ recipientId, groupId, message }, { rejectWithValue, getState }) => {
    try {
      console.log('Sending message:', { recipientId, groupId, message });
      
      const currentUser = getState().auth.user;
      const contacts = getState().contacts.contacts;
      let encryptedData;
      
      if (recipientId) {
        // Direct message - Find recipient's public key
        const recipient = contacts.find(
          (contact) => contact.id === recipientId
        );
        
        if (!recipient) {
          console.error('Recipient not found in contacts:', recipientId);
          return rejectWithValue('Recipient not found in contacts');
        }
        
        if (!recipient.publicKey) {
          console.error('Recipient public key not available:', recipient);
          return rejectWithValue('Recipient public key not available - You must be connected contacts to exchange messages');
        }
        
        console.log('Encrypting message for recipient:', recipient.username);
        try {
          encryptedData = await encryptMessage(message, recipient.publicKey);
          console.log('Message encrypted successfully');
        } catch (err) {
          console.error('Encryption error:', err);
          return rejectWithValue('Failed to encrypt message: ' + err.message);
        }
        
        const messagePayload = {
          recipientId,
          message: encryptedData.encryptedMessage,
          encryptedKey: encryptedData.encryptedKey,
          metadata: encryptedData.metadata
        };
        
        console.log('Message payload prepared:', { recipientId, encryptionSuccess: !!encryptedData });
        
        // Try to send via socket first
        if (socketService.isConnected()) {
          console.log('Socket connected, sending message via socket');
          socketService.sendPrivateMessage(messagePayload);
        } else {
          console.log('Socket not connected, saving for offline sync');
          // Fall back to HTTP API
          // Store for sync when back online
          await storeOfflineMessage(messagePayload);
          
          // Try to sync immediately
          syncOfflineMessages();
        }
        
        // Return message object to store in redux
        const msgId = Date.now().toString();
        console.log('Storing message in redux with ID:', msgId);
        
        return {
          id: msgId,
          senderId: currentUser.id,
          senderUsername: currentUser.username,
          recipientId,
          message, // Store original message for display
          timestamp: Date.now(),
          conversationId: [currentUser.id, recipientId].sort().join(':'),
          status: socketService.isConnected() ? 'sent' : 'pending',
        };
      } else if (groupId) {
        console.log('Sending group message to group:', groupId);
        // Group message
        const group = getState().groups.groups.find((g) => g.id === groupId);
        
        if (!group) {
          console.error('Group not found:', groupId);
          return rejectWithValue('Group not found');
        }
        
        console.log('Group found:', group.name, 'with members:', group.members);
        
        // Encrypt message for each group member
        const encryptedKeys = {};
        let anyKeysFound = false;
        
        for (const memberId of group.members) {
          if (memberId === currentUser.id) {
            console.log('Skipping self for encryption:', memberId);
            continue; // Skip self
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
              // Continue with other members
            }
          } else {
            console.log('Member missing or has no public key:', memberId);
          }
        }
        
        if (!anyKeysFound) {
          console.error('No valid recipients with public keys in the group');
          return rejectWithValue('No valid recipients with public keys - You must be connected with at least one member');
        }
        
        console.log('Successfully encrypted for', Object.keys(encryptedKeys).length, 'members');
        
        // We'll use the same encrypted message for all recipients to save bandwidth
        const firstContact = contacts.find(c => c.publicKey);
        if (!firstContact) {
          console.error('No contact with public key found for base encryption');
          return rejectWithValue('Cannot find a valid public key for encryption');
        }
        
        encryptedData = await encryptMessage(message, firstContact.publicKey);
        
        const groupMessagePayload = {
          groupId,
          message: encryptedData.encryptedMessage,
          encryptedKeys,
          metadata: encryptedData.metadata
        };
        
        console.log('Group message payload prepared');
        
        // Try to send via socket first
        if (socketService.isConnected()) {
          console.log('Socket connected, sending group message via socket');
          socketService.sendGroupMessage(groupMessagePayload);
        } else {
          console.log('Socket not connected, saving group message for offline sync');
          // Fall back to HTTP API
          // Store for sync when back online
          await storeOfflineMessage(groupMessagePayload);
          
          // Try to sync immediately
          syncOfflineMessages();
        }
        
        // Return message object to store in redux
        const msgId = Date.now().toString();
        console.log('Storing group message in redux with ID:', msgId);
        
        return {
          id: msgId,
          senderId: currentUser.id,
          senderUsername: currentUser.username,
          groupId,
          message, // Store original message for display
          timestamp: Date.now(),
          conversationId: `group:${groupId}`,
          status: socketService.isConnected() ? 'sent' : 'pending',
        };
      }
    } catch (error) {
      console.error('Send message error:', error);
      return rejectWithValue(error.message || 'Failed to send message');
    }
  }
);

const initialState = {
  conversations: {},
  activeConversation: null,
  loading: false,
  error: null,
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
      const conversationId = message.conversationId;
      
      if (!state.conversations[conversationId]) {
        state.conversations[conversationId] = [];
      }
      
      // Check if message already exists
      const messageExists = state.conversations[conversationId].some(
        (msg) => msg.id === message.id
      );
      
      if (!messageExists) {
        state.conversations[conversationId].push(message);
        
        // Sort by timestamp
        state.conversations[conversationId].sort((a, b) => a.timestamp - b.timestamp);
      }
    },
    updateMessageStatus: (state, action) => {
      const { messageId, conversationId, status } = action.payload;
      
      if (state.conversations[conversationId]) {
        const messageIndex = state.conversations[conversationId].findIndex(
          (msg) => msg.id === messageId
        );
        
        if (messageIndex !== -1) {
          state.conversations[conversationId][messageIndex].status = status;
        }
      }
    },
    clearMessageError: (state) => {
      state.error = null;
    },
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
        // Assurez-vous que action.payload contient les données attendues
        if (action.payload && action.payload.conversationId && Array.isArray(action.payload.messages)) {
          state.conversations[action.payload.conversationId] = action.payload.messages;
          console.log(`Updated messages for conversation ${action.payload.conversationId}, count: ${action.payload.messages.length}`);
        } else {
          console.error('Invalid payload format in fetchConversationMessages.fulfilled:', action.payload);
        }
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
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
        
        const conversationId = message.conversationId;
        console.log(`Adding new message to conversation ${conversationId}:`, message);
        
        if (!state.conversations[conversationId]) {
          state.conversations[conversationId] = [];
        }
        
        // Vérifier si le message existe déjà pour éviter les doublons
        const messageExists = state.conversations[conversationId].some(
          (msg) => msg.id === message.id
        );
        
        if (!messageExists) {
          state.conversations[conversationId].push(message);
          
          // Sort by timestamp
          state.conversations[conversationId].sort((a, b) => a.timestamp - b.timestamp);
          
          console.log(`Message added to conversation ${conversationId}, new count:`, 
            state.conversations[conversationId].length);
        } else {
          console.log(`Message ${message.id} already exists in conversation ${conversationId}`);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { setActiveConversation, addMessage, updateMessageStatus, clearMessageError } = messagesSlice.actions;

export default messagesSlice.reducer;
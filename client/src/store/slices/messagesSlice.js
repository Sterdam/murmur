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
      const response = await api.get(`/messages/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      
      const messages = response.data.data;
      const currentUser = getState().auth.user;
      const privateKey = getState().auth.privateKey;
      
      // Decrypt messages
      const decryptedMessages = await Promise.all(
        messages.map(async (message) => {
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
            
            const decrypted = await decryptMessage(
              message.message,
              message.encryptedKey,
              privateKey
            );
            
            return {
              ...message,
              message: decrypted,
            };
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            return {
              ...message,
              message: '[Encrypted message - Decryption failed]',
            };
          }
        })
      );
      
      return {
        conversationId,
        messages: decryptedMessages,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async ({ recipientId, groupId, message }, { rejectWithValue, getState }) => {
    try {
      const currentUser = getState().auth.user;
      const contacts = getState().contacts.contacts;
      let encryptedData;
      
      if (recipientId) {
        // Direct message - Find recipient's public key
        const recipient = contacts.find(
          (contact) => contact.id === recipientId
        );
        
        if (!recipient) {
          return rejectWithValue('Recipient not found in contacts');
        }
        
        if (!recipient.publicKey) {
          return rejectWithValue('Recipient public key not available - You must be connected contacts to exchange messages');
        }
        
        try {
          encryptedData = await encryptMessage(message, recipient.publicKey);
        } catch (err) {
          console.error('Encryption error:', err);
          return rejectWithValue('Failed to encrypt message');
        }
        
        // Try to send via socket first
        if (socketService.isConnected()) {
          socketService.sendPrivateMessage({
            recipientId,
            message: encryptedData.encryptedMessage,
            encryptedKey: encryptedData.encryptedKey,
          });
        } else {
          // Fall back to HTTP API
          const offlineMessage = {
            recipientId,
            message: encryptedData.encryptedMessage,
            encryptedKey: encryptedData.encryptedKey,
          };
          
          // Store for sync when back online
          await storeOfflineMessage(offlineMessage);
          
          // Try to sync immediately
          syncOfflineMessages();
        }
        
        return {
          id: Date.now().toString(), // Temporary ID
          senderId: currentUser.id,
          recipientId,
          message, // Store original message for display
          timestamp: Date.now(),
          conversationId: [currentUser.id, recipientId].sort().join(':'),
          status: socketService.isConnected() ? 'sent' : 'pending',
        };
      } else if (groupId) {
        // Group message
        const group = getState().groups.groups.find((g) => g.id === groupId);
        
        if (!group) {
          return rejectWithValue('Group not found');
        }
        
        // Encrypt message for each group member
        const encryptedKeys = {};
        let anyKeysFound = false;
        
        for (const memberId of group.members) {
          if (memberId === currentUser.id) continue; // Skip self
          
          const member = contacts.find(
            (contact) => contact.id === memberId
          );
          
          if (member && member.publicKey) {
            anyKeysFound = true;
            try {
              const encrypted = await encryptMessage(message, member.publicKey);
              encryptedKeys[memberId] = encrypted.encryptedKey;
            } catch (err) {
              console.error(`Failed to encrypt for member ${memberId}:`, err);
              // Continue with other members
            }
          }
        }
        
        if (!anyKeysFound) {
          return rejectWithValue('No valid recipients with public keys - You must be connected with at least one member');
        }
        
        // We'll use the same encrypted message for all recipients to save bandwidth
        encryptedData = await encryptMessage(message, Object.values(contacts)[0]?.publicKey || 'default-key');
        
        // Try to send via socket first
        if (socketService.isConnected()) {
          socketService.sendGroupMessage({
            groupId,
            message: encryptedData.encryptedMessage,
            encryptedKeys,
          });
        } else {
          // Fall back to HTTP API
          const offlineMessage = {
            groupId,
            message: encryptedData.encryptedMessage,
            encryptedKeys,
          };
          
          // Store for sync when back online
          await storeOfflineMessage(offlineMessage);
          
          // Try to sync immediately
          syncOfflineMessages();
        }
        
        return {
          id: Date.now().toString(), // Temporary ID
          senderId: currentUser.id,
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
        state.conversations[action.payload.conversationId] = action.payload.messages;
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const conversationId = message.conversationId;
        
        if (!state.conversations[conversationId]) {
          state.conversations[conversationId] = [];
        }
        
        state.conversations[conversationId].push(message);
        
        // Sort by timestamp
        state.conversations[conversationId].sort((a, b) => a.timestamp - b.timestamp);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { setActiveConversation, addMessage, updateMessageStatus, clearMessageError } = messagesSlice.actions;

export default messagesSlice.reducer;
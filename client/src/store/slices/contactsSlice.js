// client/src/store/slices/contactsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/contacts');
      
      // Vérifier la structure de la réponse
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid API response format');
      }
      
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to fetch contacts. Please check your connection and try again.'
      );
    }
  }
);

export const fetchContactRequests = createAsyncThunk(
  'contacts/fetchContactRequests',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/contact-requests');
      
      // Ajouter un log détaillé pour déboguer
      console.log("Contact requests raw response:", response);
      console.log("Contact requests data:", response.data);
      
      // S'assurer que le format est correct avec des valeurs par défaut
      if (!response.data || !response.data.data) {
        console.error('Format de réponse invalide pour les demandes de contact', response.data);
        return { incoming: [], outgoing: [] };
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching contact requests:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to fetch contact requests.'
      );
    }
  }
);

export const sendContactRequest = createAsyncThunk(
  'contacts/sendContactRequest',
  async (username, { rejectWithValue }) => {
    try {
      console.log(`Sending contact request to: ${username}`);
      
      if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
      }
      
      const response = await api.post('/users/contact-requests', { username });
      
      console.log('Contact request response:', response.data);
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Unknown error occurred');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Error sending contact request:', error);
      
      if (error.response && error.response.status === 404) {
        return rejectWithValue('User not found. Please check the username and try again.');
      }
      
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to send contact request. Please try again later.'
      );
    }
  }
);

export const acceptContactRequest = createAsyncThunk(
  'contacts/acceptContactRequest',
  async (requestId, { rejectWithValue }) => {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }
      
      console.log(`Accepting contact request: ${requestId}`);
      const response = await api.post(`/users/contact-requests/${requestId}/accept`);
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to accept request');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Error accepting contact request:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to accept contact request.'
      );
    }
  }
);

export const rejectContactRequest = createAsyncThunk(
  'contacts/rejectContactRequest',
  async (requestId, { rejectWithValue }) => {
    try {
      if (!requestId) {
        throw new Error('Request ID is required');
      }
      
      console.log(`Rejecting contact request: ${requestId}`);
      const response = await api.post(`/users/contact-requests/${requestId}/reject`);
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to reject request');
      }
      
      return requestId; // Retourner l'ID pour faciliter la mise à jour du state
    } catch (error) {
      console.error('Error rejecting contact request:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to reject contact request.'
      );
    }
  }
);

export const searchUsers = createAsyncThunk(
  'contacts/searchUsers',
  async (username, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/search?username=${encodeURIComponent(username)}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error searching users:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'User search failed. Please try again.'
      );
    }
  }
);

const initialState = {
  contacts: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  loading: false,
  requestLoading: false,
  searchLoading: false,
  error: null,
  requestError: null,
  searchError: null,
  requestSuccess: false
};

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchLoading = false;
      state.searchError = null;
    },
    clearContactError: (state) => {
      state.error = null;
    },
    clearRequestError: (state) => {
      state.requestError = null;
    },
    clearRequestSuccess: (state) => {
      state.requestSuccess = false;
    },
    clearAllErrors: (state) => {
      state.error = null;
      state.requestError = null;
      state.searchError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Contacts
      .addCase(fetchContacts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts = Array.isArray(action.payload) ? action.payload : [];
        if (!Array.isArray(action.payload)) {
          console.warn('Expected array for contacts, got:', typeof action.payload);
        }
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch contacts';
      })
      
      // Fetch Contact Requests
      .addCase(fetchContactRequests.pending, (state) => {
        state.requestLoading = true;
        state.requestError = null;
      })
      .addCase(fetchContactRequests.fulfilled, (state, action) => {
        state.requestLoading = false;
        // Assurer que les données sont correctement formatées avec des valeurs par défaut
        const data = action.payload || {};
        state.incomingRequests = Array.isArray(data.incoming) ? data.incoming : [];
        state.outgoingRequests = Array.isArray(data.outgoing) ? data.outgoing : [];
        
        console.log('Updated state after fetching requests:', {
          incomingCount: state.incomingRequests.length,
          outgoingCount: state.outgoingRequests.length
        });
      })
      .addCase(fetchContactRequests.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to fetch contact requests';
        // Réinitialiser les tableaux pour éviter d'afficher des données obsolètes
        state.incomingRequests = [];
        state.outgoingRequests = [];
      })
      
      // Send Contact Request
      .addCase(sendContactRequest.pending, (state) => {
        state.requestLoading = true;
        state.requestError = null;
        state.requestSuccess = false;
      })
      .addCase(sendContactRequest.fulfilled, (state, action) => {
        state.requestLoading = false;
        state.requestSuccess = true;
        
        if (action.payload) {
          // Vérifier si cette demande existe déjà
          const exists = state.outgoingRequests.some(req => req.id === action.payload.id);
          if (!exists) {
            state.outgoingRequests.push(action.payload);
          } else {
            console.log('Request already exists in outgoing requests');
          }
        }
      })
      .addCase(sendContactRequest.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to send contact request';
        state.requestSuccess = false;
      })
      
      // Accept Contact Request
      .addCase(acceptContactRequest.pending, (state) => {
        state.requestLoading = true;
        state.requestError = null;
      })
      .addCase(acceptContactRequest.fulfilled, (state, action) => {
        state.requestLoading = false;
        
        if (action.payload) {
          // Ajouter aux contacts en évitant les doublons
          const contactExists = state.contacts.some(contact => contact.id === action.payload.id);
          if (!contactExists) {
            state.contacts.push(action.payload);
          }
          
          // Supprimer de la liste des demandes entrantes
          state.incomingRequests = state.incomingRequests.filter(
            request => request.id !== action.meta.arg
          );
        }
      })
      .addCase(acceptContactRequest.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to accept contact request';
      })
      
      // Reject Contact Request
      .addCase(rejectContactRequest.pending, (state) => {
        state.requestLoading = true;
        state.requestError = null;
      })
      .addCase(rejectContactRequest.fulfilled, (state, action) => {
        state.requestLoading = false;
        // Supprimer de la liste des demandes entrantes
        state.incomingRequests = state.incomingRequests.filter(
          request => request.id !== action.meta.arg
        );
      })
      .addCase(rejectContactRequest.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to reject contact request';
      })
      
      // Search Users
      .addCase(searchUsers.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload || 'User search failed';
      });
  },
});

export const { 
  clearSearchResults, 
  clearContactError, 
  clearRequestError,
  clearRequestSuccess,
  clearAllErrors
} = contactsSlice.actions;

export default contactsSlice.reducer;
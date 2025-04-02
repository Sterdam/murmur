// client/src/store/slices/contactsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue, getState }) => {
    try {
      // Vérifier si on a déjà des contacts et qu'on est en train de recharger (pas le chargement initial)
      const { contacts, loading } = getState().contacts;
      
      // Si on recharge et qu'on a déjà des contacts, on peut être moins stricts en cas d'erreur
      const isReloading = contacts && contacts.length > 0;
      
      // Stocker l'ETag pour les requêtes suivantes
      let etag = localStorage.getItem('contacts_etag');
      
      // Options de requête avec cache headers si disponibles
      const requestOptions = {};
      if (etag) {
        requestOptions.headers = {
          'If-None-Match': etag
        };
      }
      
      // Effectuer la requête avec les options de cache
      console.log('Fetching contacts from API', etag ? '(with ETag)' : '');
      const response = await api.get('/users/contacts', requestOptions);
      
      // Store the new ETag if provided
      const newEtag = response.headers['etag'];
      if (newEtag) {
        localStorage.setItem('contacts_etag', newEtag);
        console.log('Updated contacts ETag:', newEtag);
      }
      
      // If we got a 304 Not Modified, use our existing data
      if (response.status === 304) {
        console.log('Server returned 304 Not Modified, using cached contacts');
        return getState().contacts.contacts;
      }
      
      // Vérifier la structure de la réponse
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid API response format');
      }
      
      // Extraire les données avec valeur par défaut
      const contactsData = response.data.data || [];
      console.log(`Received ${contactsData.length} contacts from API`);
      
      return contactsData;
    } catch (error) {
      // Handle different error types
      
      // 304 Not Modified - use existing data (should be handled above but just in case)
      if (error.response?.status === 304 && getState().contacts.contacts.length > 0) {
        console.log('304 Not Modified response in error handler, using existing data');
        return getState().contacts.contacts;
      }
      
      // 429 Too Many Requests - use existing data
      if (error.response?.status === 429 && getState().contacts.contacts.length > 0) {
        console.warn('Rate limited (429) while refreshing contacts, using existing data');
        return getState().contacts.contacts;
      }
      
      // Network errors - use existing data if available
      if (error.message === 'Network Error' && getState().contacts.contacts.length > 0) {
        console.warn('Network error while refreshing contacts, using existing data');
        return getState().contacts.contacts;
      }
      
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
  async (_, { rejectWithValue, getState }) => {
    try {
      // Get existing ETag from localStorage
      let etag = localStorage.getItem('requests_etag');
      
      // Set up request options with cache headers if available
      const requestOptions = {};
      if (etag) {
        requestOptions.headers = {
          'If-None-Match': etag
        };
      }
      
      console.log('Fetching contact requests from API', etag ? '(with ETag)' : '');
      const response = await api.get('/users/contact-requests', requestOptions);
      
      // Store the new ETag if provided
      const newEtag = response.headers['etag'];
      if (newEtag) {
        localStorage.setItem('requests_etag', newEtag);
        console.log('Updated requests ETag:', newEtag);
      }
      
      // If we got a 304 Not Modified, use our existing data
      if (response.status === 304) {
        console.log('Server returned 304 Not Modified, using cached requests');
        const { incomingRequests, outgoingRequests } = getState().contacts;
        return {
          incoming: incomingRequests || [],
          outgoing: outgoingRequests || []
        };
      }
      
      // Log pour déboguer
      console.log("Contact requests data:", response.data);
      
      // S'assurer que le format est correct avec des valeurs par défaut
      if (!response.data || !response.data.data) {
        console.error('Format de réponse invalide pour les demandes de contact', response.data);
        return { incoming: [], outgoing: [] };
      }
      
      console.log(`Received contact requests - Incoming: ${response.data.data.incoming?.length || 0}, Outgoing: ${response.data.data.outgoing?.length || 0}`);
      return response.data.data;
    } catch (error) {
      // Handle different error cases
      
      // 304 Not Modified - use existing data
      if (error.response?.status === 304) {
        console.log('304 Not Modified in error handler, using cached requests');
        const { incomingRequests, outgoingRequests } = getState().contacts;
        return {
          incoming: incomingRequests || [],
          outgoing: outgoingRequests || []
        };
      }
      
      // 429 Too Many Requests - use existing data if available
      if (error.response?.status === 429) {
        const { incomingRequests, outgoingRequests } = getState().contacts;
        
        if (Array.isArray(incomingRequests) || Array.isArray(outgoingRequests)) {
          console.warn('Rate limited (429) while refreshing contact requests, using existing data');
          return {
            incoming: incomingRequests || [],
            outgoing: outgoingRequests || []
          };
        }
      }
      
      // Network errors - use existing data if available
      if (error.message === 'Network Error') {
        const { incomingRequests, outgoingRequests } = getState().contacts;
        if (Array.isArray(incomingRequests) || Array.isArray(outgoingRequests)) {
          console.warn('Network error while refreshing contact requests, using existing data');
          return {
            incoming: incomingRequests || [],
            outgoing: outgoingRequests || []
          };
        }
      }
      
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
  async (username, { rejectWithValue, getState }) => {
    try {
      console.log(`Sending contact request to: ${username}`);
      
      if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided');
      }
      
      // Vérifier si on est déjà connecté avec cet utilisateur
      const state = getState();
      const contacts = state.contacts.contacts;
      
      // Éviter d'envoyer une demande si déjà en contact
      const existingContact = contacts.find(contact => 
        contact.username.toLowerCase() === username.toLowerCase());
      
      if (existingContact) {
        return rejectWithValue('Cet utilisateur fait déjà partie de vos contacts.');
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
      
      if (error.response && error.response.status === 403) {
        return rejectWithValue('Vous n\'êtes pas autorisé à contacter cet utilisateur.');
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
      
      console.log('Accept contact request response:', response.data);
      return {
        contact: response.data.data,
        requestId: requestId
      };
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
        
        // Vérifier et normaliser les données
        const contacts = Array.isArray(action.payload) ? action.payload : [];
        
        // Seulement mettre à jour si on a des contacts ou si le tableau était vide avant
        if (contacts.length > 0 || state.contacts.length === 0) {
          state.contacts = contacts;
          console.log(`Updated contacts store with ${contacts.length} contacts`);
        } else {
          console.log('Keeping existing contacts, received empty array');
        }
        
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
        
        // Vérification et normalisation des tableaux
        const incoming = Array.isArray(data.incoming) ? data.incoming : [];
        const outgoing = Array.isArray(data.outgoing) ? data.outgoing : [];
        
        // Mise à jour seulement si on a des données ou si les tableaux étaient vides
        if (incoming.length > 0 || state.incomingRequests.length === 0) {
          state.incomingRequests = incoming;
        } else {
          console.log('Keeping existing incoming requests, received empty array');
        }
        
        if (outgoing.length > 0 || state.outgoingRequests.length === 0) {
          state.outgoingRequests = outgoing;
        } else {
          console.log('Keeping existing outgoing requests, received empty array');
        }
        
        console.log('Updated state after fetching requests:', {
          incomingCount: state.incomingRequests.length,
          outgoingCount: state.outgoingRequests.length
        });
      })
      .addCase(fetchContactRequests.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to fetch contact requests';
        
        // Ne pas réinitialiser les tableaux en cas d'erreur pour préserver les données existantes
        // En cas d'erreur 429 notamment, on veut garder les données précédentes
        console.log('Error fetching contact requests, keeping existing data');
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
        
        if (action.payload && action.payload.contact) {
          // Ajouter aux contacts en évitant les doublons
          const contactExists = state.contacts.some(contact => contact.id === action.payload.contact.id);
          if (!contactExists) {
            state.contacts.push(action.payload.contact);
            console.log('Added contact to state:', action.payload.contact);
          }
          
          // Supprimer de la liste des demandes entrantes
          state.incomingRequests = state.incomingRequests.filter(
            request => request.id !== action.payload.requestId
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
// client/src/store/slices/contactsSlice.js - Corrigé
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await api.get('/users/contacts');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        'Failed to fetch contacts. Please check your connection and try again.'
      );
    }
  }
);

export const addContact = createAsyncThunk(
  'contacts/addContact',
  async (username, { rejectWithValue, getState }) => {
    try {
      // Ajouter d'abord le contact
      const response = await api.post('/users/contacts', { username });
      
      // Si le contact a été ajouté avec succès
      if (response.data && response.data.success) {
        if (response.data.data) {
          return response.data.data;
        }
        
        // Si les données du contact ne sont pas dans la réponse, rechercher l'utilisateur
        try {
          const searchResponse = await api.get(`/users/search?username=${username}`);
          
          if (searchResponse.data.data && searchResponse.data.data.length > 0) {
            return searchResponse.data.data[0];
          }
          
          // Si aucun utilisateur n'est trouvé, retourner un objet avec les informations de base
          return {
            id: `temp-${Date.now()}`,
            username: username,
            displayName: username,
            status: 'Pending'
          };
        } catch (searchError) {
          console.warn('User search failed after adding contact:', searchError);
          // Retourner quand même un contact temporaire pour une expérience utilisateur harmonieuse
          return {
            id: `temp-${Date.now()}`,
            username: username,
            displayName: username,
            status: 'Pending'
          };
        }
      }
      
      throw new Error('Failed to add contact');
    } catch (error) {
      console.error('Error adding contact:', error);
      
      if (error.response && error.response.status === 404) {
        return rejectWithValue('User not found. Please check the username and try again.');
      }
      
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to add contact. Please try again later.'
      );
    }
  }
);

export const searchUsers = createAsyncThunk(
  'contacts/searchUsers',
  async (username, { rejectWithValue, getState }) => {
    try {
      const response = await api.get(`/users/search?username=${username}`);
      return response.data.data;
    } catch (error) {
      console.error('Error searching users:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        'User search failed. Please try again.'
      );
    }
  }
);

const initialState = {
  contacts: [],
  searchResults: [],
  loading: false,
  searchLoading: false,
  error: null,
};

const contactsSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
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
        // S'assurer que action.payload est un tableau
        state.contacts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch contacts';
      })
      // Add Contact
      .addCase(addContact.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addContact.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Vérifier si le contact existe déjà
          const contactExists = state.contacts.some(
            (contact) => contact.id === action.payload.id || 
                         contact.username === action.payload.username
          );
          
          if (!contactExists) {
            state.contacts.push(action.payload);
          }
        }
      })
      .addCase(addContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to add contact';
      })
      // Search Users
      .addCase(searchUsers.pending, (state) => {
        state.searchLoading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchLoading = false;
        // S'assurer que action.payload est un tableau
        state.searchResults = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.payload || 'User search failed';
      });
  },
});

export const { clearSearchResults, clearError } = contactsSlice.actions;

export default contactsSlice.reducer;
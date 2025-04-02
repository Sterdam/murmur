import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await api.get('/users/contacts', {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch contacts');
    }
  }
);

export const addContact = createAsyncThunk(
  'contacts/addContact',
  async (username, { rejectWithValue, getState }) => {
    try {
      const response = await api.post('/users/contacts', { username }, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      
      // Return the contact data from the response if available
      if (response.data && response.data.data) {
        return response.data.data;
      }
      
      // If no contact data in response, fetch the contact details
      if (response.data.success) {
        // Try to get contact info from search
        const searchResponse = await api.get(`/users/search?username=${username}`, {
          headers: {
            Authorization: `Bearer ${getState().auth.token}`,
          },
        });
        
        if (searchResponse.data.data.length > 0) {
          return searchResponse.data.data[0];
        }
      }
      
      throw new Error("Contact added but details not available");
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add contact');
    }
  }
);

export const searchUsers = createAsyncThunk(
  'contacts/searchUsers',
  async (username, { rejectWithValue, getState }) => {
    try {
      const response = await api.get(`/users/search?username=${username}`, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'User search failed');
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
        state.contacts = action.payload;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Add Contact
      .addCase(addContact.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addContact.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          // Check if contact already exists
          const contactExists = state.contacts.some(
            (contact) => contact.id === action.payload.id
          );
          
          if (!contactExists) {
            state.contacts.push(action.payload);
          }
        }
      })
      .addCase(addContact.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Search Users
      .addCase(searchUsers.pending, (state) => {
        state.searchLoading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSearchResults, clearError } = contactsSlice.actions;

export default contactsSlice.reducer;
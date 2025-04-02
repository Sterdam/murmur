// client/src/store/slices/contactsSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const fetchContacts = createAsyncThunk(
  'contacts/fetchContacts',
  async (_, { rejectWithValue }) => {
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

export const fetchContactRequests = createAsyncThunk(
  'contacts/fetchContactRequests',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/contact-requests');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching contact requests:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        'Failed to fetch contact requests.'
      );
    }
  }
);

export const sendContactRequest = createAsyncThunk(
  'contacts/sendContactRequest',
  async (username, { rejectWithValue }) => {
    try {
      const response = await api.post('/users/contact-requests', { username });
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
      const response = await api.post(`/users/contact-requests/${requestId}/accept`);
      return response.data.data;
    } catch (error) {
      console.error('Error accepting contact request:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        'Failed to accept contact request.'
      );
    }
  }
);

export const rejectContactRequest = createAsyncThunk(
  'contacts/rejectContactRequest',
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/users/contact-requests/${requestId}/reject`);
      return response.data.data;
    } catch (error) {
      console.error('Error rejecting contact request:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        'Failed to reject contact request.'
      );
    }
  }
);

export const searchUsers = createAsyncThunk(
  'contacts/searchUsers',
  async (username, { rejectWithValue }) => {
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
        if (action.payload) {
          state.incomingRequests = action.payload.incoming || [];
          state.outgoingRequests = action.payload.outgoing || [];
        }
      })
      .addCase(fetchContactRequests.rejected, (state, action) => {
        state.requestLoading = false;
        state.requestError = action.payload || 'Failed to fetch contact requests';
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
          state.outgoingRequests.push(action.payload);
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
          // Add to contacts
          state.contacts.push(action.payload);
          
          // Remove from incoming requests
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
        // Remove from incoming requests
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
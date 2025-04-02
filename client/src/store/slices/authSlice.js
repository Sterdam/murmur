// client/src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storeCredentials, clearCredentials, getCredentials } from '../../utils/storage';

// Async thunks
export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ username, password, publicKey }, { rejectWithValue }) => {
    try {
      console.log('Registering user with public key:', publicKey ? `${publicKey.substring(0, 20)}...` : 'none');
      
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      const response = await api.post('/auth/register', { 
        username, 
        password, 
        publicKey
      });
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Registration failed');
      }
      
      if (!response.data.data || !response.data.data.token) {
        throw new Error('Invalid response format from server: missing token');
      }
      
      console.log('Registration API response successful');
      return response.data.data;
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response?.status === 409) {
        return rejectWithValue('Username already taken. Please choose a different username.');
      }
      
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Registration failed'
      );
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Login failed'
      );
    }
  }
);

// Fonction simplifiée sans utiliser l'API du serveur
// Utilise plutôt des clés générées localement dans le component Register
export const generateKeyPair = createAsyncThunk(
  'auth/generateKeyPair',
  async (_, { rejectWithValue }) => {
    // Cette fonction est vide car nous gérons la génération de clés 
    // directement dans le composant Register.js
    return {};
  }
);

export const updateUser = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue, getState }) => {
    try {
      const response = await api.put('/users/profile', profileData, {
        headers: {
          Authorization: `Bearer ${getState().auth.token}`,
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Profile update failed'
      );
    }
  }
);

// Load saved credentials on startup
const savedCredentials = getCredentials();

const initialState = {
  user: savedCredentials?.user || null,
  token: savedCredentials?.token || null,
  privateKey: null,
  publicKey: null,
  isAuthenticated: !!savedCredentials?.token,
  settings: {
    theme: 'dark',
    language: 'en',
    notifications: true,
    soundEffects: true,
    sendReadReceipts: true,
    autoDownload: 'wifi',
    storageLimit: '1GB',
    deleteMessagesAfter: 'never',
  },
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.privateKey = null;
      state.publicKey = null;
      clearCredentials();
    },
    setKeys: (state, action) => {
      state.privateKey = action.payload.privateKey;
      state.publicKey = action.payload.publicKey;
    },
    updateSettings: (state, action) => {
      state.settings = {
        ...state.settings,
        ...action.payload
      };
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        storeCredentials(action.payload);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        storeCredentials(action.payload);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Generate Key Pair (vide car géré dans Register.js)
      .addCase(generateKeyPair.fulfilled, (state, action) => {
        // Ne rien faire ici, car les clés sont gérées dans Register.js
      })
      // Update Profile
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        
        // Update stored credentials
        storeCredentials({
          user: action.payload,
          token: state.token,
        });
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, setKeys, updateSettings, clearError } = authSlice.actions;

export default authSlice.reducer;
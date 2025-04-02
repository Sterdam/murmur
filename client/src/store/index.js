import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import messagesReducer from './slices/messagesSlice';
import contactsReducer from './slices/contactsSlice';
import groupsReducer from './slices/groupsSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    messages: messagesReducer,
    contacts: contactsReducer,
    groups: groupsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values like crypto keys
        ignoredActionPaths: ['payload.privateKey', 'payload.publicKey'],
        ignoredPaths: ['auth.privateKey', 'auth.publicKey'],
      },
    }),
});

export default store;

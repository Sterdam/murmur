// client/src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import messagesReducer from './slices/messagesSlice';
import contactsReducer from './slices/contactsSlice';
import groupsReducer from './slices/groupsSlice';

// Store avec configuration optimisée
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
        // Ignorer les valeurs non-sérialisables comme les clés cryptographiques
        ignoredActionPaths: [
          'payload.privateKey', 
          'payload.publicKey',
          'payload.keys',
          'meta.arg.publicKey',
          'meta.arg.privateKey'
        ],
        ignoredPaths: [
          'auth.privateKey', 
          'auth.publicKey'
        ],
      },
      // Activer le mode de développement uniquement en environnement non-production
      immutableCheck: process.env.NODE_ENV !== 'production',
      thunk: {
        extraArgument: undefined,
      },
    }),
  // Activer le DevTools uniquement en environnement non-production
  devTools: process.env.NODE_ENV !== 'production',
});

// Exposer getState et dispatch pour un accès global (utilisé par socket.js)
export const getStoreState = () => store.getState();
export const dispatchStoreAction = (action) => store.dispatch(action);

export default store;
// Modifiez client/src/store/index.js pour exporter le store
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import messagesReducer from './slices/messagesSlice';
import contactsReducer from './slices/contactsSlice';
import groupsReducer from './slices/groupsSlice';
import { createPersistMiddleware, loadPersistedState } from './persistMiddleware';

// Référence globale au store pour accès par d'autres services
let globalStore;

// Charger l'état persisté depuis localStorage
const preloadedState = loadPersistedState();

// Store avec configuration optimisée
const store = configureStore({
  reducer: {
    auth: authReducer,
    messages: messagesReducer,
    contacts: contactsReducer,
    groups: groupsReducer,
  },
  preloadedState, // Charger l'état persisté
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
    }).concat(createPersistMiddleware()), // Ajouter le middleware de persistance
  // Activer le DevTools uniquement en environnement non-production
  devTools: process.env.NODE_ENV !== 'production',
});

// Sauvegarder la référence au store
globalStore = store;

// Fonction pour définir le store globalement (utilisée dans index.js)
export const setStore = (storeInstance) => {
  globalStore = storeInstance;
};

// Exposer getState et dispatch pour un accès global (utilisé par services)
export const getStoreState = () => globalStore.getState();
export const dispatchStoreAction = (action) => globalStore.dispatch(action);

export default store;
// Dans client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import store, { setStore } from './store';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { ThemeProvider } from 'styled-components';
import GlobalStyle from './styles/GlobalStyle';
import theme from './styles/theme';
import { registerSyncEvents } from './utils/offlineSync';
import { setupBackgroundSync } from './services/backgroundSync';

// Définir le store pour qu'il soit accessible par d'autres services
setStore(store);

// Initialize offline sync
registerSyncEvents();

// Initialiser le service de synchronisation en arrière-plan
const backgroundSyncInterval = setupBackgroundSync();

// Nettoyer la synchronisation d'arrière-plan au déchargement de la page
window.addEventListener('beforeunload', () => {
  if (backgroundSyncInterval) {
    clearInterval(backgroundSyncInterval);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);

// Service worker désactivé en développement
serviceWorkerRegistration.unregister();
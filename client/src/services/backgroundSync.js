// client/src/services/backgroundSync.js
import { getStoreState, dispatchStoreAction } from '../store/index';
import socketService from './socket';
import { storeOfflineMessage, syncOfflineMessages } from '../utils/offlineSync';
import { updateMessageStatus } from '../store/slices/messagesSlice';

// Fonction pour mettre à jour les messages en attente
export const updatePendingMessages = () => {
  if (socketService.isConnected()) {
    // Déclencher l'action pour mettre à jour les messages en attente
    dispatchStoreAction({ type: 'messages/updatePendingMessages' });
    
    // Tenter de synchroniser les messages hors ligne
    syncOfflineMessages().catch(err => {
      console.warn('Failed to sync offline messages during background update:', err);
    });
  }
};

// Configurer un intervalle pour vérifier et mettre à jour les messages en attente
export const setupBackgroundSync = () => {
  // Vérifier et mettre à jour les messages en attente toutes les 10 secondes
  const intervalId = setInterval(() => {
    if (!document.hidden) { // Ne pas exécuter si l'onglet est en arrière-plan
      updatePendingMessages();
    }
  }, 10000);
  
  // Vérifier aussi lorsque l'état de visibilité change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updatePendingMessages();
    }
  });
  
  // Vérifier lorsque la fenêtre récupère le focus
  window.addEventListener('focus', () => {
    updatePendingMessages();
  });
  
  // Vérifier aussi lorsque la connexion réseau change
  window.addEventListener('online', () => {
    console.log('Connection restored, attempting to reconnect socket and sync messages');
    
    // Si le token est disponible, tenter de reconnecter le socket
    const token = localStorage.getItem('token');
    if (token) {
      socketService.connect(token).then(connected => {
        if (connected) {
          // Mettre à jour les messages en attente
          updatePendingMessages();
        }
      });
    }
  });
  
  return intervalId;
};

// Fonction de nettoyage
export const cleanupBackgroundSync = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
};
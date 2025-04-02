import { v4 as uuidv4 } from 'uuid';
import api from '../services/api';

/**
 * Open IndexedDB database for offline storage
 * @returns {Promise<IDBDatabase>} - IndexedDB database instance
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('murmur-offline-db', 2);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'id' });
      }
      
      // Add stores for offline data caching
      if (!db.objectStoreNames.contains('messages-cache')) {
        db.createObjectStore('messages-cache', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('contacts-cache')) {
        db.createObjectStore('contacts-cache', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('groups-cache')) {
        db.createObjectStore('groups-cache', { keyPath: 'id' });
      }
      
      // Add store for geo-location preferences
      if (!db.objectStoreNames.contains('geo-preferences')) {
        db.createObjectStore('geo-preferences', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Store a message for offline sync
 * @param {Object} message - Message to store
 * @returns {Promise<string>} - ID of stored message
 */
export const storeOfflineMessage = async (message) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['pending-messages'], 'readwrite');
    const store = transaction.objectStore('pending-messages');
    
    const messageWithId = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now(),
    };
    
    const request = store.add(messageWithId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(messageWithId.id);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error storing offline message:', error);
    return null;
  }
};

/**
 * Get all pending messages from offline storage
 * @returns {Promise<Array>} - Array of pending messages
 */
export const getPendingMessages = async () => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['pending-messages'], 'readonly');
    const store = transaction.objectStore('pending-messages');
    
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting pending messages:', error);
    return [];
  }
};

/**
 * Remove a message from offline storage
 * @param {string} messageId - ID of message to remove
 * @returns {Promise<boolean>} - Success status
 */
export const removePendingMessage = async (messageId) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['pending-messages'], 'readwrite');
    const store = transaction.objectStore('pending-messages');
    
    const request = store.delete(messageId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error removing pending message:', error);
    return false;
  }
};

/**
 * Store authentication credentials in offline storage
 * @param {Object} credentials - Authentication credentials
 * @returns {Promise<boolean>} - Success status
 */
export const storeAuthCredentials = async (credentials) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['auth'], 'readwrite');
    const store = transaction.objectStore('auth');
    
    const credentialsWithId = {
      ...credentials,
      id: 'credentials',
    };
    
    const request = store.put(credentialsWithId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error storing auth credentials:', error);
    return false;
  }
};

/**
 * Sync pending messages with the server
 * @returns {Promise<Array>} - Array of synced message IDs
 */
export const syncOfflineMessages = async () => {
  try {
    // Check if online
    if (!navigator.onLine) {
      return [];
    }
    
    const pendingMessages = await getPendingMessages();
    
    if (pendingMessages.length === 0) {
      return [];
    }
    
    const syncedIds = [];
    
    for (const message of pendingMessages) {
      try {
        // Send message to server
        await api.post('/messages', message);
        
        // Remove from pending queue
        await removePendingMessage(message.id);
        
        syncedIds.push(message.id);
      } catch (error) {
        console.error('Error syncing message:', error);
      }
    }
    
    return syncedIds;
  } catch (error) {
    console.error('Error syncing offline messages:', error);
    return [];
  }
};

/**
 * Cache data for offline use
 * @param {string} storeType - Type of data to cache ('messages', 'contacts', 'groups')
 * @param {Array} data - Data to cache
 * @returns {Promise<boolean>} - Success status
 */
export const cacheOfflineData = async (storeType, data) => {
  try {
    if (!Array.isArray(data)) {
      console.error('Cache data must be an array');
      return false;
    }
    
    const db = await openDatabase();
    const storeName = `${storeType}-cache`;
    
    // Check if store exists
    if (!db.objectStoreNames.contains(storeName)) {
      console.error(`Store ${storeName} does not exist`);
      return false;
    }
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Clean previous data
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Add new data
    for (const item of data) {
      if (!item.id) {
        console.warn('Cached item missing ID, skipping', item);
        continue;
      }
      
      await new Promise((resolve, reject) => {
        const request = store.add({
          ...item,
          cachedAt: Date.now(),
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    return true;
  } catch (error) {
    console.error(`Error caching ${storeType} data:`, error);
    return false;
  }
};

/**
 * Get cached data
 * @param {string} storeType - Type of data to retrieve ('messages', 'contacts', 'groups')
 * @returns {Promise<Array>} - Cached data
 */
export const getCachedData = async (storeType) => {
  try {
    const db = await openDatabase();
    const storeName = `${storeType}-cache`;
    
    // Check if store exists
    if (!db.objectStoreNames.contains(storeName)) {
      console.error(`Store ${storeName} does not exist`);
      return [];
    }
    
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error getting cached ${storeType} data:`, error);
    return [];
  }
};

/**
 * Store user's geo preferences
 * @param {Object} preferences - Geo preferences object
 * @returns {Promise<boolean>} - Success status
 */
export const storeGeoPreferences = async (preferences) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['geo-preferences'], 'readwrite');
    const store = transaction.objectStore('geo-preferences');
    
    const preferencesWithId = {
      ...preferences,
      id: 'user-preferences',
      updatedAt: Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(preferencesWithId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error storing geo preferences:', error);
    return false;
  }
};

/**
 * Get user's geo preferences
 * @returns {Promise<Object>} - Geo preferences
 */
export const getGeoPreferences = async () => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['geo-preferences'], 'readonly');
    const store = transaction.objectStore('geo-preferences');
    
    return new Promise((resolve, reject) => {
      const request = store.get('user-preferences');
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting geo preferences:', error);
    return {};
  }
};

/**
 * Register for browser online event to sync messages
 */
export const registerSyncEvents = () => {
  window.addEventListener('online', () => {
    syncOfflineMessages();
  });
  
  // Also try to sync when service worker wakes up
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.sync.register('sync-messages');
      
      // Setup periodic sync for data if available
      if ('periodicSync' in registration) {
        // Request permission for periodic sync
        navigator.permissions.query({
          name: 'periodic-background-sync',
        }).then((status) => {
          if (status.state === 'granted') {
            registration.periodicSync.register('sync-app-data', {
              minInterval: 24 * 60 * 60 * 1000, // 24 hours
            });
          }
        });
      }
    });
  }
};

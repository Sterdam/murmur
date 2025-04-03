import React, { useEffect, createContext, useState, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import socketService from './services/socket';
import { getEncryptionKeys } from './utils/storage';
import { setKeys } from './store/slices/authSlice';
import { addMessage, updateMessageStatus, normalizeConversationId } from './store/slices/messagesSlice';
import { decryptMessage } from './services/encryption';
import { rehydrateStoreAction } from './store/persistMiddleware';
import { setupBackgroundSync, cleanupBackgroundSync } from './services/backgroundSync';

// Components
import PrivateRoute from './components/routing/PrivateRoute';
import PublicRoute from './components/routing/PublicRoute';
import Header from './components/ui/Header';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Contacts from './pages/Contacts';
import Groups from './pages/Groups';

// Create contexts
export const SecurityContext = createContext({
  user: null,
  isAuthenticated: false,
  token: null
});

// Context Providers
const SecurityProvider = ({ children }) => {
  const { user, isAuthenticated, token } = useSelector((state) => state.auth);
  
  return (
    <SecurityContext.Provider value={{ user, isAuthenticated, token }}>
      {children}
    </SecurityContext.Provider>
  );
};

const App = () => {
  const { isAuthenticated, token, user } = useSelector((state) => state.auth);
  const { groups } = useSelector((state) => state.groups);
  const dispatch = useDispatch();
  
  const [initialized, setInitialized] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // References for tracking initialization and sync interval
  const socketInitialized = useRef(false);
  const backgroundSyncInterval = useRef(null);

  // Define message handlers as callbacks to avoid unnecessary recreations
  const handlePrivateMessage = useCallback(async (data) => {
    if (!data || !user || !user.id) return;

    try {
      // Get user encryption keys
      const keys = getEncryptionKeys();
      const privateKey = keys?.privateKey;
      
      if (!privateKey) {
        console.error('No private key available for decryption');
        return;
      }
      
      // Normalize conversation ID
      let conversationId = data.conversationId;
      if (!conversationId) {
        const participants = [user.id, data.senderId].sort();
        conversationId = participants.join(':');
      }
      
      // Decrypt message if possible
      let messageText = data.message;
      let encryptionFailed = false;
      
      try {
        if (data.encryptedKey && privateKey) {
          const metadata = data.metadata || '{}';
          messageText = await decryptMessage(
            data.message,
            data.encryptedKey,
            privateKey,
            null,
            null,
            metadata
          );
        }
      } catch (decryptError) {
        console.error('Failed to decrypt received message:', decryptError);
        messageText = '[Encrypted message - Unable to decrypt]';
        encryptionFailed = true;
      }
      
      // Create message object
      const messageObject = {
        ...data,
        message: messageText,
        conversationId,
        encryptionFailed,
        id: data.id || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: data.timestamp || Date.now()
      };
      
      // Add message to store
      dispatch(addMessage({ message: messageObject }));
      
      // Show notification if app is in background
      if (document.hidden) {
        showNotification(data.senderUsername, encryptionFailed ? 
          '[Encrypted message]' : messageText.substring(0, 60) + (messageText.length > 60 ? '...' : ''));
      }
      
      // Persist messages
      dispatch(rehydrateStoreAction());
    } catch (error) {
      console.error('Error processing private message:', error);
    }
  }, [dispatch, user]);

  const handleGroupMessage = useCallback(async (data) => {
    if (!data || !data.groupId || !user || !user.id) return;

    try {
      const conversationId = `group:${data.groupId}`;
      
      // Get encryption keys
      const keys = getEncryptionKeys();
      const privateKey = keys?.privateKey;
      
      if (!privateKey) {
        console.error('No private key available for decryption');
        return;
      }
      
      // Decrypt message if possible
      let messageText = data.message;
      let encryptionFailed = false;
      
      try {
        // Check if this message contains a key for this user
        const encryptedKey = data.encryptedKeys?.[user.id];
        
        if (encryptedKey && privateKey) {
          const metadata = data.metadata || '{}';
          messageText = await decryptMessage(
            data.message,
            encryptedKey,
            privateKey,
            null,
            null,
            metadata
          );
        }
      } catch (decryptError) {
        console.error('Failed to decrypt received group message:', decryptError);
        messageText = '[Encrypted message - Unable to decrypt]';
        encryptionFailed = true;
      }
      
      // Create message object
      const messageObject = {
        ...data,
        message: messageText,
        conversationId,
        encryptionFailed,
        id: data.id || `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: data.timestamp || Date.now()
      };
      
      // Add message to store
      dispatch(addMessage({ message: messageObject }));
      
      // Show notification if app is in background
      if (document.hidden) {
        const group = groups?.find(g => g.id === data.groupId);
        const title = group ? `${data.senderUsername} in ${group.name}` : data.senderUsername;
        showNotification(title, encryptionFailed ? 
          '[Encrypted message]' : messageText.substring(0, 60) + (messageText.length > 60 ? '...' : ''));
      }
    } catch (error) {
      console.error('Error handling group message:', error);
    }
  }, [dispatch, user, groups]);

  const handleMessageDelivery = useCallback((data) => {
    if (!data || !data.messageId || !data.conversationId) return;
    
    dispatch(updateMessageStatus({
      messageId: data.messageId,
      conversationId: normalizeConversationId(data.conversationId),
      status: data.delivered ? 'delivered' : 'sent',
    }));
  }, [dispatch]);

  const handleTypingIndicator = useCallback((data) => {
    // This functionality can be extended with a Redux action for typing indicators
    // For now, we'll just log it
    console.log('Typing indicator received:', data);
  }, []);

  // Utility function for displaying notifications
  const showNotification = (title, body) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification(title, { 
        body: body, 
        icon: '/logo192.png',
        silent: false
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { 
            body: body, 
            icon: '/logo192.png',
            silent: false
          });
        }
      });
    }
  };

  // Effect for socket connection and reconnection
  useEffect(() => {
    let socketCleanup = null;
    
    const setupSocket = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        // Connect socket with token
        const connected = await socketService.connect(token);
        
        if (connected) {
          setSocketConnected(true);
          
          // Set up event handlers
          socketService.setupEventHandlers(
            handlePrivateMessage,
            handleGroupMessage,
            handleMessageDelivery,
            handleTypingIndicator
          );
          
          // Join all user groups
          if (groups && groups.length > 0) {
            socketService.joinGroups(groups);
          }
          
          // Set up background sync
          if (backgroundSyncInterval.current) {
            cleanupBackgroundSync(backgroundSyncInterval.current);
          }
          backgroundSyncInterval.current = setupBackgroundSync();
          
          // Return cleanup function
          socketCleanup = () => {
            if (socketService.isConnected()) {
              socketService.disconnect();
            }
            if (backgroundSyncInterval.current) {
              cleanupBackgroundSync(backgroundSyncInterval.current);
              backgroundSyncInterval.current = null;
            }
          };
        } else {
          setSocketConnected(false);
          socketInitialized.current = false;
        }
      } catch (error) {
        console.error('Socket initialization error:', error);
        setSocketConnected(false);
        socketInitialized.current = false;
      }
    };
    
    if (isAuthenticated && token && !socketInitialized.current) {
      socketInitialized.current = true;
      setupSocket();
    } else if (!isAuthenticated) {
      socketInitialized.current = false;
      setSocketConnected(false);
      
      if (socketCleanup) {
        socketCleanup();
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (socketCleanup) {
        socketCleanup();
      }
    };
  }, [
    isAuthenticated, 
    token,
    handlePrivateMessage,
    handleGroupMessage,
    handleMessageDelivery,
    handleTypingIndicator,
    groups
  ]);

  // Effect for joining groups when they change
  useEffect(() => {
    if (socketConnected && groups && groups.length > 0) {
      socketService.joinGroups(groups);
    }
  }, [groups, socketConnected]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Rehydrate store
        dispatch(rehydrateStoreAction());
        
        // Load encryption keys
        const keys = getEncryptionKeys();
        if (keys) {
          dispatch(setKeys(keys));
        }
        
        // Request notification permissions if not already granted
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('App initialization error:', error);
        setInitialized(true);
      }
    };
    
    initializeApp();
    
    // Cleanup on unmount
    return () => {
      if (backgroundSyncInterval.current) {
        cleanupBackgroundSync(backgroundSyncInterval.current);
      }
    };
  }, [dispatch]);

  // Display loading screen until initialized
  if (!initialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#121212',
        color: '#ffffff',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '20px', fontSize: '24px' }}>Murmur</div>
        <div>Loading secure messaging...</div>
      </div>
    );
  }

  return (
    <SecurityProvider>
      <Router>
        <div style={{ paddingTop: '60px' }}>
          <Header />
          <Routes>
            {/* Public routes */}
            <Route 
              path="/login" 
              element={
                <PublicRoute isAuthenticated={isAuthenticated}>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute isAuthenticated={isAuthenticated}>
                  <Register />
                </PublicRoute>
              } 
            />
            
            {/* Protected routes */}
            <Route 
              path="/" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Home />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/chat/:conversationId" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Chat />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Settings />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Profile />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/contacts" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Contacts />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/groups" 
              element={
                <PrivateRoute isAuthenticated={isAuthenticated}>
                  <Groups />
                </PrivateRoute>
              } 
            />
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </SecurityProvider>
  );
};

export default App;
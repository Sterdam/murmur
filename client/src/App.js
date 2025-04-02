// client/src/App.js
import React, { useEffect, createContext, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import socketService from './services/socket';
import { getEncryptionKeys } from './utils/storage';
import { setKeys } from './store/slices/authSlice';
import { addMessage, updateMessageStatus } from './store/slices/messagesSlice';

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

  // Définir les gestionnaires de messages comme callbacks pour éviter les re-créations inutiles
  const handlePrivateMessage = useCallback((data) => {
    try {
      // Traitement du message privé
      const decryptedMessage = data.message; // Simplifié, pas de déchiffrement réel ici
      
      if (!user || !user.id) {
        console.error('User data not available for handling private message');
        return;
      }
      
      const conversationId = [user.id, data.senderId].sort().join(':');
      
      // Dispatch l'action pour ajouter le message
      dispatch(addMessage({
        message: {
          ...data,
          message: decryptedMessage,
          conversationId,
        },
      }));
      
      // Notification si l'app est en arrière-plan
      if (document.hidden) {
        showNotification(data.senderUsername, decryptedMessage);
      }
    } catch (error) {
      console.error('Error handling private message:', error);
    }
  }, [dispatch, user]);
  
  const handleGroupMessage = useCallback((data) => {
    try {
      // Traitement du message de groupe
      const decryptedMessage = data.message; // Simplifié
      
      if (!user || !user.id) {
        console.error('User data not available for handling group message');
        return;
      }
      
      const conversationId = `group:${data.groupId}`;
      
      // Dispatch l'action pour ajouter le message
      dispatch(addMessage({
        message: {
          ...data,
          message: decryptedMessage,
          conversationId,
        },
      }));
      
      // Notification si en arrière-plan
      if (document.hidden) {
        const group = groups?.find(g => g.id === data.groupId);
        const title = group ? `${data.senderUsername} in ${group.name}` : data.senderUsername;
        showNotification(title, decryptedMessage);
      }
    } catch (error) {
      console.error('Error handling group message:', error);
    }
  }, [dispatch, user, groups]);
  
  const handleMessageDelivery = useCallback((data) => {
    try {
      if (!user || !user.id || !data.recipientId) {
        return;
      }
      
      const conversationId = [user.id, data.recipientId].sort().join(':');
      
      dispatch(updateMessageStatus({
        messageId: data.id,
        conversationId,
        status: data.delivered ? 'delivered' : 'sent',
      }));
    } catch (error) {
      console.error('Error handling message delivery:', error);
    }
  }, [dispatch, user]);
  
  // Gestionnaire d'indicateur de frappe (simple placeholder)
  const handleTypingIndicator = useCallback(() => {}, []);
  
  // Fonction utilitaire pour afficher des notifications
  const showNotification = (title, body) => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/logo192.png' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: '/logo192.png' });
          }
        });
      }
    }
  };

  // Initialiser l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Charger les clés de chiffrement si disponibles
        const keys = getEncryptionKeys();
        if (keys) {
          console.log("Loading encryption keys from storage");
          dispatch(setKeys(keys));
        }
        
        // Initialiser la connexion socket si authentifié
        if (isAuthenticated && token) {
          console.log("Connecting to socket with token");
          
          // Connecter le socket avec le token
          if (socketService.connect(token)) {
            console.log("Socket connected, setting up handlers");
            
            // Configurer les gestionnaires de messages
            socketService.setupEventHandlers(
              handlePrivateMessage,
              handleGroupMessage,
              handleMessageDelivery,
              handleTypingIndicator
            );
            
            // Rejoindre tous les groupes de l'utilisateur
            if (groups && groups.length > 0) {
              socketService.joinGroups(groups);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setInitialized(true);
      }
    };
    
    initializeApp();
    
    // Nettoyage à la déconnexion
    return () => {
      if (socketService.isConnected()) {
        socketService.disconnect();
      }
    };
  }, [
    isAuthenticated, 
    token, 
    dispatch, 
    groups,
    handlePrivateMessage,
    handleGroupMessage,
    handleMessageDelivery,
    handleTypingIndicator
  ]);

  if (!initialized) {
    // Afficher un écran de chargement si nécessaire
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#121212',
        color: '#ffffff'
      }}>
        <h2>Chargement de Murmur...</h2>
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
// client/src/App.js
import React, { useEffect, createContext, useState, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import socketService from './services/socket';
import { getEncryptionKeys } from './utils/storage';
import { setKeys } from './store/slices/authSlice';
import { addMessage, updateMessageStatus, normalizeConversationId } from './store/slices/messagesSlice';
import { decryptMessage } from './services/encryption';
import { rehydrateStoreAction } from './store/persistMiddleware';

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
  
  // Référence pour suivre si on a déjà initialisé le socket
  const socketInitialized = useRef(false);

  // Définir les gestionnaires de messages comme callbacks pour éviter les re-créations inutiles
  const handlePrivateMessage = useCallback(async (data) => {
    try {
      console.log('Message privé reçu:', {
        expediteur: data.senderUsername, 
        longueurMessage: data.message?.length,
        avecCleChiffree: !!data.encryptedKey
      });
      
      if (!user || !user.id) {
        console.error('Données utilisateur non disponibles pour traiter le message privé');
        return;
      }
      
      // Récupérer les informations de l'utilisateur
      const { privateKey } = getEncryptionKeys() || {};
      
      if (!privateKey) {
        console.error('Aucune clé privée disponible pour le déchiffrement');
        return;
      }
      
      // Créer l'ID de conversation normalisé
      const participants = [user.id, data.senderId].sort();
      const conversationId = participants.join(':');
      
      console.log(`ID de conversation normalisé: ${conversationId}`);
      
      // Essayer de déchiffrer le message
      let messageText = data.message;
      try {
        if (data.encryptedKey && privateKey) {
          console.log('Tentative de déchiffrement du message avec encryptedKey');
          const metadata = data.metadata || '{}'; 
          messageText = await decryptMessage(
            data.message,
            data.encryptedKey,
            privateKey,
            null,
            null,
            metadata
          );
          console.log('Message déchiffré avec succès');
        }
      } catch (decryptError) {
        console.error('Échec du déchiffrement du message reçu:', decryptError);
        messageText = '[Message chiffré - Impossible de déchiffrer]';
      }
      
      // Dispatch l'action pour ajouter le message
      const messageObject = {
        ...data,
        message: messageText,
        conversationId,
        id: data.id || Date.now().toString() + Math.floor(Math.random() * 1000),
        timestamp: data.timestamp || Date.now()
      };
      
      console.log('Ajout du message au store:', messageObject.id);
      
      // Important: Utiliser la structure correcte pour l'action
      dispatch(addMessage({
        message: messageObject,
      }));
      
      // Notification si l'app est en arrière-plan
      if (document.hidden) {
        showNotification(data.senderUsername, messageText);
      }
      
      // Persister les messages immédiatement
      dispatch(rehydrateStoreAction());
    } catch (error) {
      console.error('Erreur de traitement du message privé:', error);
    }
  }, [dispatch, user]);
  
  const handleGroupMessage = useCallback(async (data) => {
    try {
      console.log('Received group message:', data);
      
      if (!user || !user.id) {
        console.error('User data not available for handling group message');
        return;
      }
      
      const conversationId = `group:${data.groupId}`;
      
      // Récupérer la clé privée
      const { privateKey } = getEncryptionKeys() || {};
      
      if (!privateKey) {
        console.error('No private key available for decryption');
        return;
      }
      
      // Extraire la clé pour cet utilisateur 
      let messageText = data.message;
      try {
        // Vérifier si ce message contient une clé pour cet utilisateur
        const encryptedKey = data.encryptedKeys && data.encryptedKeys[user.id];
        
        if (encryptedKey && privateKey) {
          console.log('Trying to decrypt group message with user key');
          const metadata = data.metadata || '{}';
          messageText = await decryptMessage(
            data.message,
            encryptedKey,
            privateKey,
            null,
            null,
            metadata
          );
          console.log('Group message decrypted successfully');
        }
      } catch (decryptError) {
        console.error('Failed to decrypt received group message:', decryptError);
        messageText = '[Message chiffré - Impossible de déchiffrer]';
      }
      
      // Dispatch l'action pour ajouter le message
      dispatch(addMessage({
        message: {
          ...data,
          message: messageText,
          conversationId,
          id: data.id || Date.now().toString(),
          timestamp: data.timestamp || Date.now()
        },
      }));
      
      // Notification si en arrière-plan
      if (document.hidden) {
        const group = groups?.find(g => g.id === data.groupId);
        const title = group ? `${data.senderUsername} in ${group.name}` : data.senderUsername;
        showNotification(title, messageText);
      }
    } catch (error) {
      console.error('Error handling group message:', error);
    }
  }, [dispatch, user, groups]);
  
  const handleMessageDelivery = useCallback((data) => {
    try {
      if (!user || !user.id || !data || !data.recipientId) {
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
  const handleTypingIndicator = useCallback((data) => {
    // Implémentation simplifiée - vous pourriez ajouter une action Redux pour afficher un indicateur de frappe
    console.log('Typing indicator received:', data);
  }, []);
  
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

  // CORRECTION: Utiliser un useEffect séparé pour initialiser le socket une seule fois
  useEffect(() => {
    if (isAuthenticated && token && !socketInitialized.current) {
      console.log("Connecting to socket with token (initialization)");
      
      // Connecter le socket avec le token
      if (socketService.connect(token)) {
        console.log("Socket connected, setting up handlers");
        socketInitialized.current = true;
        setSocketConnected(true);
        
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
    
    // Nettoyage à la déconnexion
    return () => {
      if (socketConnected) {
        console.log("Disconnecting socket on cleanup");
        socketService.disconnect();
        setSocketConnected(false);
      }
    };
  }, [
    isAuthenticated, 
    token,
    handlePrivateMessage,
    handleGroupMessage,
    handleMessageDelivery,
    handleTypingIndicator,
    groups,
    socketConnected
  ]);

  // Initialiser l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Réhydrater le store dès le début
        dispatch(rehydrateStoreAction());
        
        // Charger les clés de chiffrement si disponibles
        const keys = getEncryptionKeys();
        if (keys) {
          console.log("Chargement des clés de chiffrement depuis le stockage");
          dispatch(setKeys(keys));
        }
        
        setInitialized(true);
      } catch (error) {
        console.error("Erreur d'initialisation de l'app:", error);
        setInitialized(true);
      }
    };
    
    initializeApp();
  }, [dispatch]);

  // CORRECTION: Effet pour reconnecter le socket si les groupes changent
  useEffect(() => {
    if (socketConnected && groups && groups.length > 0) {
      console.log("Joining groups after groups update");
      // Rejoindre tous les nouveaux groupes
      socketService.joinGroups(groups);
    }
  }, [groups, socketConnected]);

  if (!initialized) {
    // Afficher un écran de chargement
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
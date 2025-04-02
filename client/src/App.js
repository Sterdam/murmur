// client/src/App.js
import React, { useEffect, createContext, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import socketService from './services/socket';
import { getEncryptionKeys } from './utils/storage';
import { setKeys } from './store/slices/authSlice';

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
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [initialized, setInitialized] = useState(false);

  // Initialize app - load encryption keys and setup socket
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load encryption keys if available
        const keys = getEncryptionKeys();
        if (keys) {
          console.log("Loading encryption keys from storage");
          dispatch(setKeys(keys));
        }
        
        // Initialize socket when authenticated
        if (isAuthenticated && token) {
          console.log("Initializing socket connection");
          socketService.initSocket({
            getState: () => ({
              auth: { token }
            })
          });
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setInitialized(true);
      }
    };
    
    initializeApp();
    
    return () => {
      // Disconnect socket on unmount
      if (socketService.isConnected && socketService.isConnected()) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, token, dispatch]);

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
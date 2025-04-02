import React, { useEffect, createContext } from 'react';
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
  isAuthenticated: false
});

export const SpookixContext = createContext(null);

// Context Providers
const SecurityProvider = ({ children }) => {
  const { user, isAuthenticated, token } = useSelector((state) => state.auth);
  
  return (
    <SecurityContext.Provider value={{ user, isAuthenticated, token }}>
      {children}
    </SecurityContext.Provider>
  );
};

const SpookixProvider = ({ children }) => {
  return (
    <SpookixContext.Provider value={null}>
      {children}
    </SpookixContext.Provider>
  );
};

const App = () => {
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // Initialize socket when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.initSocket(dispatch);
      
      // Load encryption keys if available
      const keys = getEncryptionKeys();
      if (keys) {
        dispatch(setKeys(keys));
      }
    }
    
    return () => {
      // Disconnect socket on unmount
      socketService.disconnect();
    };
  }, [isAuthenticated, token, dispatch]);

  return (
    <SpookixProvider>
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
    </SpookixProvider>
  );
};

export default App;
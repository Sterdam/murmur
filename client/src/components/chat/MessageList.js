import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { fetchConversationMessages } from '../../store/slices/messagesSlice';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

// Components
import Avatar from '../ui/Avatar';

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
`;

const MessageGroup = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  max-width: 85%;
  align-self: ${({ sent }) => (sent ? 'flex-end' : 'flex-start')};
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
`;

const SenderName = styled.span`
  font-weight: 500;
  font-size: 0.875rem;
  margin-left: 8px;
`;

const MessageContent = styled.div`
  background-color: ${({ theme, sent }) =>
    sent ? theme.colors.primary : 'rgba(255, 255, 255, 0.08)'};
  color: ${({ theme, sent }) => (sent ? theme.colors.onPrimary : theme.colors.textPrimary)};
  padding: 10px 16px;
  border-radius: 18px;
  max-width: 100%;
  word-wrap: break-word;
  box-shadow: ${({ theme }) => theme.elevation[1]};
  position: relative;
  
  & + & {
    margin-top: 4px;
    border-top-right-radius: ${({ sent }) => (sent ? 4 : 18)}px;
    border-top-left-radius: ${({ sent }) => (sent ? 18 : 4)}px;
  }
  
  /* Style pour les messages chiffrés qu'on ne peut pas déchiffrer */
  ${({ encrypted }) => encrypted && `
    font-style: italic;
    opacity: 0.7;
  `}
`;

const Timestamp = styled.span`
  font-size: 0.75rem;
  color: ${({ theme, sent }) => sent ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textSecondary};
  margin-top: 4px;
  align-self: ${({ sent }) => (sent ? 'flex-end' : 'flex-start')};
`;

const MessageStatus = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 4px;
  
  &::before {
    content: '•';
    margin-right: 4px;
  }
`;

const DateDivider = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0;
  
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.12);
  }
`;

const DateText = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  
  h3 {
    margin-bottom: 8px;
  }
  
  p {
    max-width: 400px;
    margin-bottom: 16px;
  }
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  padding: 20px;
  
  h3 {
    margin-bottom: 10px;
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    max-width: 400px;
    margin-bottom: 15px;
  }
`;

const LoadingIndicator = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
  
  svg {
    animation: spin 1s linear infinite;
    margin-bottom: 8px;
    opacity: 0.7;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  span {
    font-size: 0.875rem;
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const StyledButton = styled.button`
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryDark};
  }
  
  svg {
    margin-right: 8px;
  }
`;

const MessageList = ({ conversationId }) => {
  const dispatch = useDispatch();
  const { conversations, loading, error } = useSelector((state) => state.messages);
  const { user } = useSelector((state) => state.auth);
  
  const listContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [oldScrollHeight, setOldScrollHeight] = useState(0);
  
  // Fonction memoïsée pour normaliser les IDs de conversation
  const getNormalizedId = useCallback((id) => {
    if (!id) return '';
    
    if (id.startsWith('group:')) return id;
    
    if (id.includes(':')) {
      const parts = id.split(':');
      if (parts.length === 2) {
        return parts.sort().join(':');
      }
    }
    
    return id;
  }, []);
  
  const normalizedId = getNormalizedId(conversationId);
  
  // Récupérer les messages avec fallback sur l'ID non normalisé si nécessaire
  const messages = useSelector(state => {
    const messagesFromStore = 
      state.messages.conversations[normalizedId] || 
      state.messages.conversations[conversationId] || 
      [];
    
    // S'assurer que l'array est valide
    return Array.isArray(messagesFromStore) ? messagesFromStore : [];
  });
  
  // Récupérer les messages lorsque l'ID de conversation change
  useEffect(() => {
    if (!conversationId) return;
    
    // Nettoyer les erreurs précédentes
    setLocalError(null);
    setIsInitialLoad(true);
    
    // Fonction pour charger les messages
    const loadMessages = async () => {
      try {
        await dispatch(fetchConversationMessages(conversationId)).unwrap();
        setIsInitialLoad(false);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        setLocalError(err);
        setIsInitialLoad(false);
      }
    };
    
    // Charger les messages initialement
    loadMessages();
    
    // Configurer un intervalle pour rafraîchir périodiquement (toutes les 60 secondes)
    const intervalId = setInterval(() => {
      loadMessages().catch(err => {
        console.warn('Background message refresh failed:', err);
        // Ne pas mettre à jour l'erreur pour les rafraîchissements en arrière-plan
      });
    }, 60000);
    
    return () => {
      clearInterval(intervalId);
      setLocalError(null);
    };
  }, [conversationId, dispatch]);
  
  // Surveiller les changements dans les messages pour détecter les nouveaux messages
  useEffect(() => {
    if (listContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      // Si nous sommes en bas ou c'est le chargement initial, faire défiler vers le bas
      if (atBottom || isInitialLoad) {
        // Utiliser un timeout pour s'assurer que le DOM est mis à jour
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: isInitialLoad ? 'auto' : 'smooth' });
          }
        }, 100);
      } else if (scrollHeight > oldScrollHeight) {
        // Si de nouveaux messages sont arrivés mais nous ne sommes pas en bas
        setHasNewMessages(true);
      }
      
      // Enregistrer la hauteur de défilement actuelle pour la comparaison
      setOldScrollHeight(scrollHeight);
    }
  }, [messages, isInitialLoad, oldScrollHeight]);
  
  // Fonction pour réessayer de charger les messages en cas d'erreur
  const handleRetry = async () => {
    setLocalError(null);
    try {
      await dispatch(fetchConversationMessages(conversationId)).unwrap();
    } catch (err) {
      console.error('Retry failed:', err);
      setLocalError(err);
    }
  };
  
  // Fonction pour faire défiler jusqu'aux nouveaux messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessages(false);
    }
  };
  
  // Formatter les dates
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Unknown date';
    }
  };
  
  // Formater l'heure
  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      return date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Time formatting error:', error);
      return '';
    }
  };
  
  // Vérifier si un message contient une indication de chiffrement échouée
  const isEncryptedMessage = (message) => {
    return message && typeof message === 'string' && 
      (message.includes('[Encrypted message') || 
       message.includes('Cannot decrypt'));
  };
  
  // Afficher un état d'erreur
  if (localError || error) {
    const errorMessage = localError || error;
    
    // Erreur d'accès non autorisé
    if (typeof errorMessage === 'string' && errorMessage.includes('Unauthorized access')) {
      return (
        <ErrorState>
          <FiAlertCircle size={40} />
          <h3>Accès non autorisé</h3>
          <p>
            Vous n'avez pas les permissions nécessaires pour accéder à cette conversation 
            ou l'identifiant de conversation est invalide.
          </p>
          <StyledButton onClick={handleRetry}>
            <FiRefreshCw />
            Réessayer
          </StyledButton>
        </ErrorState>
      );
    }
    
    // Autres erreurs
    return (
      <ErrorState>
        <FiAlertCircle size={40} />
        <h3>Erreur lors du chargement des messages</h3>
        <p>{errorMessage || "Une erreur s'est produite lors de la récupération des messages."}</p>
        <StyledButton onClick={handleRetry}>
          <FiRefreshCw />
          Réessayer
        </StyledButton>
      </ErrorState>
    );
  }
  
  // Afficher un état de chargement pour le chargement initial
  if (loading && messages.length === 0) {
    return (
      <EmptyState>
        <LoadingIndicator>
          <FiRefreshCw size={30} />
          <span>Chargement des messages...</span>
        </LoadingIndicator>
        <p>Veuillez patienter pendant que nous récupérons votre conversation de manière sécurisée.</p>
      </EmptyState>
    );
  }
  
  // Afficher un état vide si aucun message
  if (!loading && messages.length === 0) {
    return (
      <EmptyState>
        <h3>Aucun message pour le moment</h3>
        <p>Commencez la conversation en envoyant un message ci-dessous.</p>
      </EmptyState>
    );
  }
  
  // Grouper les messages par date avec gestion d'erreur robuste
  const groupedMessages = messages.reduce((groups, message) => {
    if (!message) return groups;
    
    try {
      const timestamp = message.timestamp || Date.now();
      const date = new Date(timestamp);
      
      // Vérifier que la date est valide
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp in message:', message);
        const fallbackDate = new Date().toDateString();
        if (!groups[fallbackDate]) {
          groups[fallbackDate] = [];
        }
        groups[fallbackDate].push(message);
        return groups;
      }
      
      const dateString = date.toDateString();
      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(message);
    } catch (error) {
      console.error('Error grouping message by date:', error, message);
      // Utiliser une date de fallback pour les messages problématiques
      const fallbackDate = 'Unknown Date';
      if (!groups[fallbackDate]) {
        groups[fallbackDate] = [];
      }
      groups[fallbackDate].push(message);
    }
    
    return groups;
  }, {});
  
  return (
    <ListContainer ref={listContainerRef}>
      {/* Indicateur de chargement pour les rafraîchissements non initiaux */}
      {loading && !isInitialLoad && (
        <LoadingIndicator style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)' }}>
          <FiRefreshCw size={20} />
          <span>Rafraîchissement...</span>
        </LoadingIndicator>
      )}
      
      {/* Bouton pour défiler jusqu'aux nouveaux messages */}
      {hasNewMessages && (
        <StyledButton 
          onClick={scrollToBottom}
          style={{ 
            position: 'fixed', 
            bottom: '80px', 
            left: '50%', 
            transform: 'translateX(-50%)',
            zIndex: 5,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
        >
          <FiRefreshCw />
          Nouveaux messages
        </StyledButton>
      )}
      
      {/* Rendu des messages groupés par date */}
      {Object.keys(groupedMessages).map((date) => (
        <React.Fragment key={date}>
          <DateDivider>
            <DateText>{formatDate(date)}</DateText>
          </DateDivider>
          
          {groupedMessages[date].map((message, index) => {
            if (!message) return null;
            
            const sent = message.senderId === user?.id;
            const showHeader = index === 0 || 
              groupedMessages[date][index - 1]?.senderId !== message.senderId;
            const isEncrypted = isEncryptedMessage(message.message);
            
            return (
              <MessageGroup key={message.id || index} sent={sent}>
                {!sent && showHeader && (
                  <MessageHeader>
                    <Avatar name={message.senderUsername} size="small" />
                    <SenderName>{message.senderUsername}</SenderName>
                  </MessageHeader>
                )}
                
                <MessageContent sent={sent} encrypted={isEncrypted}>
                  {message.message}
                  {sent && message.status && (
                    <MessageStatus>{message.status}</MessageStatus>
                  )}
                </MessageContent>
                
                <Timestamp sent={sent}>
                  {formatTime(message.timestamp)}
                </Timestamp>
              </MessageGroup>
            );
          })}
        </React.Fragment>
      ))}
      
      <div ref={messagesEndRef} />
    </ListContainer>
  );
};

export default MessageList;
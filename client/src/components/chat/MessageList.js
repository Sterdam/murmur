import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { fetchConversationMessages } from '../../store/slices/messagesSlice';

// Components
import Avatar from '../ui/Avatar';

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
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
  
  button {
    background-color: ${({ theme }) => theme.colors.primary};
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.primaryDark};
    }
  }
`;

// Fonction simple pour formater la date sans dépendance externe
const formatSimpleDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString();
};

// Fonction simple pour formater l'heure sans dépendance externe
const formatSimpleTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' devient '12'
  
  return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
};

const MessageList = ({ conversationId }) => {
  const dispatch = useDispatch();
  const { conversations, loading, error } = useSelector((state) => state.messages);
  const { user } = useSelector((state) => state.auth);
  
  // Normaliser l'ID de conversation pour assurer la cohérence
  const getNormalizedId = (id) => {
    if (id.startsWith('group:')) return id;
    
    if (id.includes(':')) {
      const parts = id.split(':');
      if (parts.length === 2) {
        return parts.sort().join(':');
      }
    }
    
    return id; // Format UUID ou autre, retourner tel quel
  };
  
  const normalizedId = getNormalizedId(conversationId);
  const messages = conversations[normalizedId] || conversations[conversationId] || [];
  
  const messagesEndRef = useRef(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [localError, setLocalError] = useState(null);
  
  // Récupérer les messages au chargement et démarrer un intervalle
  useEffect(() => {
    if (conversationId) {
      console.log('Fetching messages for conversation:', conversationId);
      
      // Récupération initiale après un court délai
      const initialTimeout = setTimeout(() => {
        dispatch(fetchConversationMessages(conversationId))
          .unwrap()
          .catch(err => {
            console.error('Failed initial message fetch:', err);
            setLocalError(err);
          });
      }, 800);
      
      // Rafraîchir moins fréquemment (30 secondes)
      const intervalId = setInterval(() => {
        console.log('Auto-refreshing messages for conversation:', conversationId);
        dispatch(fetchConversationMessages(conversationId))
          .unwrap()
          .catch(err => {
            console.error('Failed to refresh messages:', err);
            // Ne pas mettre à jour l'erreur locale ici pour éviter de bloquer l'interface
          });
      }, 30000); // Augmenté à 30 secondes
      
      setRefreshInterval(intervalId);
      
      return () => {
        // Nettoyage à la démontage
        clearTimeout(initialTimeout);
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
        setLocalError(null);
      };
    }
  }, [conversationId, dispatch]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Réessayer en cas d'erreur
  const handleRetry = () => {
    setLocalError(null);
    dispatch(fetchConversationMessages(conversationId))
      .unwrap()
      .catch(err => {
        console.error('Retry failed:', err);
        setLocalError(err);
      });
  };
  
  // Afficher un message d'erreur approprié
  if (localError || error) {
    const errorMessage = localError || error;
    
    // Erreur d'accès non autorisé
    if (errorMessage.includes('Unauthorized access')) {
      return (
        <ErrorState>
          <h3>Accès non autorisé</h3>
          <p>
            Vous n'avez pas les permissions nécessaires pour accéder à cette conversation 
            ou l'identifiant de conversation est invalide.
          </p>
          <button onClick={handleRetry}>Réessayer</button>
        </ErrorState>
      );
    }
    
    // Autres erreurs
    return (
      <ErrorState>
        <h3>Erreur lors du chargement des messages</h3>
        <p>{errorMessage || "Une erreur s'est produite lors de la récupération des messages."}</p>
        <button onClick={handleRetry}>Réessayer</button>
      </ErrorState>
    );
  }
  
  // Group messages by date, with safety check for message.timestamp
  const groupedMessages = messages.reduce((groups, message) => {
    if (!message || !message.timestamp) {
      console.warn('Invalid message detected:', message);
      return groups;
    }
    
    const date = new Date(message.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (date.toDateString() === today) {
      return 'Today';
    } else if (date.toDateString() === yesterday) {
      return 'Yesterday';
    } else {
      return formatSimpleDate(date);
    }
  };
  
  if (loading && messages.length === 0) {
    return (
      <EmptyState>
        <h3>Loading messages...</h3>
        <p>Please wait while we securely retrieve your conversation.</p>
      </EmptyState>
    );
  }
  
  if (!loading && messages.length === 0) {
    return (
      <EmptyState>
        <h3>No messages yet</h3>
        <p>Start the conversation by sending a message below.</p>
      </EmptyState>
    );
  }
  
  return (
    <ListContainer>
      {Object.keys(groupedMessages).map((date) => (
        <React.Fragment key={date}>
          <DateDivider>
            <DateText>{formatDate(date)}</DateText>
          </DateDivider>
          
          {groupedMessages[date].map((message, index) => {
            const sent = message.senderId === user.id;
            const showHeader = index === 0 || 
              groupedMessages[date][index - 1].senderId !== message.senderId;
            
            return (
              <MessageGroup key={message.id} sent={sent}>
                {!sent && showHeader && (
                  <MessageHeader>
                    <Avatar name={message.senderUsername} size="small" />
                    <SenderName>{message.senderUsername}</SenderName>
                  </MessageHeader>
                )}
                
                <MessageContent sent={sent}>
                  {message.message}
                  {sent && message.status && (
                    <MessageStatus>{message.status}</MessageStatus>
                  )}
                </MessageContent>
                
                <Timestamp sent={sent}>
                  {formatSimpleTime(message.timestamp)}
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
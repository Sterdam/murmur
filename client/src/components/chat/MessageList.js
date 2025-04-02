import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { fetchConversationMessages, normalizeConversationId, markConversationAsRead } from '../../store/slices/messagesSlice';
import { FiAlertCircle, FiRefreshCw, FiLock, FiChevronDown } from 'react-icons/fi';

// Components
import Avatar from '../ui/Avatar';

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
  position: relative;
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
  background-color: ${({ theme, sent, encrypted }) =>
    encrypted 
      ? 'rgba(244, 67, 54, 0.1)'
      : sent 
        ? theme.colors.primary 
        : 'rgba(255, 255, 255, 0.08)'};
  color: ${({ theme, sent, encrypted }) => 
    encrypted 
      ? theme.colors.error
      : sent 
        ? theme.colors.onPrimary 
        : theme.colors.textPrimary};
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
    opacity: 0.9;
  `}
  
  /* Icône de cadenas pour les messages chiffrés sécurisés */
  ${({ secure }) => secure && `
    &::after {
      content: '';
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
    }
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
    animation: spin 1.2s linear infinite;
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

const NewMessagesButton = styled.button`
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 24px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 5;
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryDark};
  }
  
  svg {
    margin-left: 8px;
  }
`;

const EncryptionNote = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  padding: 8px 12px;
  background-color: rgba(33, 150, 243, 0.1);
  border-radius: 4px;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  
  svg {
    margin-right: 8px;
    color: #2196F3;
  }
`;

const MessageList = ({ conversationId }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { loading, error, loadingConversationId } = useSelector((state) => state.messages);
  
  // Normaliser l'ID de conversation pour la cohérence
  const normalizedId = normalizeConversationId(conversationId);
  console.log(`MessageList: Rendu pour conversation ${conversationId} → normalisée: ${normalizedId}`);
  
  // Obtenir les messages en vérifiant les deux formes d'ID possible
  const messages = useSelector((state) => {
    const messagesNormalized = state.messages.conversations[normalizedId] || [];
    const messagesOriginal = state.messages.conversations[conversationId] || [];
    
    // Utiliser celui qui a des messages, en préférant l'ID normalisé
    const result = messagesNormalized.length > 0 ? messagesNormalized : messagesOriginal;
    console.log(`MessageList: ${result.length} messages trouvés pour ${normalizedId}`);
    return result;
  });
  
  const listContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [oldScrollHeight, setOldScrollHeight] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Effet pour charger les messages au montage du composant
  useEffect(() => {
    if (!conversationId) return;
    
    // Nettoyer les erreurs précédentes
    setLocalError(null);
    setIsInitialLoad(true);
    
    // Référence pour savoir si le composant est monté
    const isMounted = { current: true };
    
    // Fonction pour charger les messages
    const loadMessages = async () => {
      // Vérifier s'il n'est pas trop tôt pour recharger
      const now = Date.now();
      if (now - lastLoadTime < 2000 && messages.length > 0) {
        console.log(`Skip loading messages: throttled (last load ${now - lastLoadTime}ms ago)`);
        return;
      }
      
      // Vérifier si on a une requête en cours pour éviter les doublons
      if (loading && loadingConversationId === normalizedId) {
        console.log('Skip loading messages: already in progress');
        return;
      }
      
      try {
        console.log(`Loading messages for conversation: ${normalizedId}`);
        setIsLoadingMore(true);
        
        await dispatch(fetchConversationMessages(normalizedId)).unwrap();
        
        // Mettre à jour le dernier temps de chargement
        setLastLoadTime(Date.now());
        
        // Vérifier si le composant est toujours monté avant de mettre à jour l'état
        if (isMounted.current) {
          setIsInitialLoad(false);
          setIsLoadingMore(false);
          
          // Marquer la conversation comme lue
          dispatch(markConversationAsRead({
            conversationId: normalizedId,
            userId: user?.id
          }));
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        
        // Vérifier si le composant est toujours monté avant de mettre à jour l'état
        if (isMounted.current) {
          setLocalError(err);
          setIsInitialLoad(false);
          setIsLoadingMore(false);
        }
      }
    };
    
    // Charger les messages initialement avec un léger délai
    // pour éviter les requêtes simultanées lors de la navigation
    const initialLoadTimer = setTimeout(() => {
      loadMessages();
    }, 300);
    
    // Configurer un intervalle pour rafraîchir périodiquement mais moins fréquemment
    // 2 minutes au lieu de 1 minute pour réduire la charge serveur
    const intervalId = setInterval(() => {
      // Ne pas rafraîchir si le composant n'est pas visible (onglet en arrière-plan)
      if (!document.hidden) {
        console.log('Refreshing messages in background');
        loadMessages().catch(err => {
          console.warn('Background message refresh failed:', err);
        });
      }
    }, 120000); // 2 minutes
    
    // Nettoyage à la suppression du composant
    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(intervalId);
      isMounted.current = false;
      setLocalError(null);
    };
  }, [normalizedId, dispatch, messages.length, loading, loadingConversationId, lastLoadTime, user?.id]);
  
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
        
        // Si on était en bas et il y a de nouveaux messages, marquer comme lus
        if (messages.length > 0 && user?.id) {
          dispatch(markConversationAsRead({
            conversationId: normalizedId,
            userId: user.id
          }));
        }
      } else if (scrollHeight > oldScrollHeight) {
        // Si de nouveaux messages sont arrivés mais nous ne sommes pas en bas
        setHasNewMessages(true);
      }
      
      // Enregistrer la hauteur de défilement actuelle pour la comparaison
      setOldScrollHeight(scrollHeight);
    }
  }, [messages, isInitialLoad, oldScrollHeight, normalizedId, dispatch, user?.id]);
  
  // Fonction pour réessayer de charger les messages en cas d'erreur
  const handleRetry = async () => {
    setLocalError(null);
    setIsLoadingMore(true);
    
    try {
      await dispatch(fetchConversationMessages(normalizedId)).unwrap();
      setLastLoadTime(Date.now());
      setIsLoadingMore(false);
    } catch (err) {
      console.error('Retry failed:', err);
      setLocalError(err);
      setIsLoadingMore(false);
    }
  };
  
  // Fonction pour faire défiler jusqu'aux nouveaux messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessages(false);
      
      // Marquer comme lus quand on descend manuellement
      if (user?.id) {
        dispatch(markConversationAsRead({
          conversationId: normalizedId,
          userId: user.id
        }));
      }
    }
  };
  
  // Formatter les dates
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Date inconnue';
      }
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return 'Aujourd\'hui';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Hier';
      } else {
        return date.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Date inconnue';
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
  
  // Vérifier si un message contient une indication de chiffrement échoué
  const isEncryptedMessage = (message) => {
    if (!message) return false;
    
    if (message.encryptionFailed) return true;
    
    if (typeof message.message === 'string') {
      return message.message.includes('[Message chiffré') || 
             message.message.includes('Impossible de déchiffrer');
    }
    
    return false;
  };
  
  // Gérer le scroll vers le haut pour charger plus de messages (pagination)
  const handleScroll = useCallback(() => {
    if (!listContainerRef.current) return;
    
    const { scrollTop } = listContainerRef.current;
    
    // Si on est au début de la liste et il y a déjà des messages, charger plus
    if (scrollTop < 20 && messages.length > 0 && !loading && !isLoadingMore) {
      // Ici on pourrait implémenter la pagination pour charger les messages plus anciens
      console.log('Top of chat reached, could load older messages');
      // Pour l'instant on recharge simplement tous les messages
      handleRetry();
    }
  }, [loading, isLoadingMore, messages.length, handleRetry]);
  
  // Ajouter l'écouteur d'événement de scroll
  useEffect(() => {
    const listContainer = listContainerRef.current;
    if (listContainer) {
      listContainer.addEventListener('scroll', handleScroll);
      
      return () => {
        listContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);
  
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
        <EncryptionNote>
          <FiLock />
          <span>Tous les messages sont protégés par un chiffrement de bout en bout</span>
        </EncryptionNote>
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
      {/* Indicateur de chargement pour le chargement de messages plus anciens */}
      {isLoadingMore && (
        <LoadingIndicator style={{ padding: '10px 0' }}>
          <FiRefreshCw size={20} />
          <span>Chargement des messages...</span>
        </LoadingIndicator>
      )}
      
      {/* Bouton pour défiler jusqu'aux nouveaux messages */}
      {hasNewMessages && (
        <NewMessagesButton onClick={scrollToBottom}>
          Nouveaux messages
          <FiChevronDown />
        </NewMessagesButton>
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
            const isEncrypted = isEncryptedMessage(message);
            
            return (
              <MessageGroup key={message.id || index} sent={sent}>
                {!sent && showHeader && (
                  <MessageHeader>
                    <Avatar name={message.senderUsername} size="small" />
                    <SenderName>{message.senderUsername}</SenderName>
                  </MessageHeader>
                )}
                
                <MessageContent sent={sent} encrypted={isEncrypted} secure={!isEncrypted}>
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
      
      {/* Indicateur de chargement pour les rafraîchissements non initiaux */}
      {loading && !isInitialLoad && !isLoadingMore && (
        <LoadingIndicator style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(30, 30, 30, 0.7)',
          padding: '8px 16px',
          borderRadius: '16px'
        }}>
          <FiRefreshCw size={16} />
          <span>Actualisation...</span>
        </LoadingIndicator>
      )}
      
      <div ref={messagesEndRef} />
    </ListContainer>
  );
};

export default MessageList;
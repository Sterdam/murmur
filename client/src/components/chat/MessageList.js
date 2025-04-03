import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { fetchConversationMessages, markConversationAsRead } from '../../store/slices/messagesSlice';
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
  
  ${({ encrypted }) => encrypted && `
    font-style: italic;
    opacity: 0.9;
  `}
  
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

const DebugInfo = styled.div`
  font-size: 10px;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.5);
`;

const MessageList = ({ conversationId }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { 
    loading, 
    error: messagesError, 
    conversations, 
    loadingConversationId 
  } = useSelector((state) => state.messages);
  
  // Get messages for this conversation
  const messages = conversations[conversationId] || [];
  
  const listContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isLoadingRef = useRef(false);
  const hasAttemptedInitialLoadRef = useRef(false);
  const [localError, setLocalError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [oldScrollHeight, setOldScrollHeight] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    loadCount: 0,
    lastLoadStatus: '',
    lastError: null
  });
  
  // Initial load of messages - only runs once when conversation changes
  useEffect(() => {
    if (!conversationId) return;
    
    // Reset states when conversation changes
    setIsInitialLoad(true);
    setHasInitiallyLoaded(false);
    setLocalError(null);
    hasAttemptedInitialLoadRef.current = false;
    isLoadingRef.current = false;
    
    // Function to load messages
    const loadMessages = async () => {
      // Skip if already loading or already attempted
      if (isLoadingRef.current || hasAttemptedInitialLoadRef.current) {
        return;
      }
      
      try {
        console.log(`Initial load for conversation: ${conversationId}`);
        isLoadingRef.current = true;
        hasAttemptedInitialLoadRef.current = true;
        setIsLoadingMore(true);
        
        // Dispatch the fetch action with unwrap to catch errors
        await dispatch(fetchConversationMessages(conversationId)).unwrap();
        
        setDebugInfo(prev => ({
          ...prev,
          loadCount: prev.loadCount + 1,
          lastLoadStatus: 'Success - Initial Load',
          lastError: null
        }));
        
        setIsInitialLoad(false);
        setHasInitiallyLoaded(true);
        setLastLoadTime(Date.now());
        
        // Mark as read after initial load
        if (user?.id) {
          dispatch(markConversationAsRead({
            conversationId,
            userId: user.id
          }));
        }
      } catch (err) {
        console.error('Error loading messages:', err);
        setLocalError(err);
        setIsInitialLoad(false);
        setDebugInfo(prev => ({
          ...prev,
          lastLoadStatus: 'Error - Initial Load',
          lastError: err
        }));
      } finally {
        setIsLoadingMore(false);
        isLoadingRef.current = false;
      }
    };
    
    // Use a small timeout to avoid rapid loading
    const timer = setTimeout(() => {
      loadMessages();
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, [conversationId, dispatch, user?.id]);
  
  // Periodic refresh of messages - but with rate limiting
  useEffect(() => {
    if (!conversationId || !hasInitiallyLoaded) return;
    
    let refreshTimer = null;
    
    const scheduleRefresh = () => {
      // Clear any existing timer
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      
      // Set a new timer for refresh
      refreshTimer = setTimeout(() => {
        if (document.hidden || isLoadingRef.current) {
          // If tab is hidden or already loading, reschedule
          scheduleRefresh();
          return;
        }
        
        const now = Date.now();
        if (now - lastLoadTime < 15000) { // Don't refresh more often than every 15 seconds
          scheduleRefresh();
          return;
        }
        
        refreshMessages();
      }, 15000);
    };
    
    const refreshMessages = async () => {
      if (isLoadingRef.current) return;
      
      try {
        console.log(`Background refresh for conversation: ${conversationId}`);
        isLoadingRef.current = true;
        
        await dispatch(fetchConversationMessages(conversationId)).unwrap();
        setLastLoadTime(Date.now());
        
        setDebugInfo(prev => ({
          ...prev,
          loadCount: prev.loadCount + 1,
          lastLoadStatus: 'Success - Background Refresh',
          lastError: null
        }));
      } catch (err) {
        console.warn('Background refresh failed:', err);
        setDebugInfo(prev => ({
          ...prev,
          lastLoadStatus: 'Error - Background Refresh',
          lastError: err
        }));
      } finally {
        isLoadingRef.current = false;
        // Schedule next refresh after completion
        scheduleRefresh();
      }
    };
    
    // Start the refresh cycle
    scheduleRefresh();
    
    // Cleanup on unmount or conversation change
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [conversationId, hasInitiallyLoaded, lastLoadTime, dispatch]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (listContainerRef.current && messages.length > 0) {
      const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      // If we're at the bottom or it's the initial load, scroll to bottom
      if (isAtBottom || isInitialLoad) {
        // Use a small timeout to ensure the DOM is updated
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: isInitialLoad ? 'auto' : 'smooth' });
          }
        }, 100);
        
        // If at bottom and new messages, mark as read
        if (messages.length > 0 && user?.id) {
          dispatch(markConversationAsRead({
            conversationId,
            userId: user.id
          }));
        }
      } else if (scrollHeight > oldScrollHeight && oldScrollHeight > 0) {
        // If new messages arrived but we're not at the bottom
        setHasNewMessages(true);
      }
      
      // Save current scroll height for comparison
      setOldScrollHeight(scrollHeight);
    }
  }, [messages, isInitialLoad, oldScrollHeight, conversationId, dispatch, user?.id]);
  
  // Retry loading messages
  const handleRetry = async () => {
    if (isLoadingRef.current) return;
    
    setLocalError(null);
    setIsLoadingMore(true);
    isLoadingRef.current = true;
    
    try {
      console.log(`Manual retry for conversation: ${conversationId}`);
      await dispatch(fetchConversationMessages(conversationId)).unwrap();
      setLastLoadTime(Date.now());
      
      setDebugInfo(prev => ({
        ...prev,
        loadCount: prev.loadCount + 1,
        lastLoadStatus: 'Success - Manual Retry',
        lastError: null
      }));
    } catch (err) {
      console.error('Retry failed:', err);
      setLocalError(err);
      
      setDebugInfo(prev => ({
        ...prev,
        lastLoadStatus: 'Error - Manual Retry',
        lastError: err
      }));
    } finally {
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  };
  
  // Scroll to new messages
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessages(false);
      
      // Mark as read when manually scrolling down
      if (user?.id) {
        dispatch(markConversationAsRead({
          conversationId,
          userId: user.id
        }));
      }
    }
  };
  
  // Format date for display
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
  
  // Format time for display
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
  
  // Check if message indicates encryption failure
  const isEncryptedMessage = (message) => {
    if (!message) return false;
    
    if (message.encryptionFailed) return true;
    
    if (typeof message.message === 'string') {
      return message.message.includes('[Message chiffré') || 
             message.message.includes('Impossible de déchiffrer');
    }
    
    return false;
  };
  
  // Handle scroll to top to load more messages - with throttling
  const handleScroll = useCallback(() => {
    if (!listContainerRef.current || isLoadingRef.current) return;
    
    const { scrollTop } = listContainerRef.current;
    const now = Date.now();
    
    // Throttle: Don't try to load more if loaded recently
    if (now - lastLoadTime < 2000) {
      return;
    }
    
    // If at the top of the list and there are already messages, load more
    if (scrollTop < 20 && messages.length > 0 && !isLoadingMore) {
      handleRetry();
    }
  }, [isLoadingMore, messages.length, lastLoadTime]);
  
  // Add scroll event listener with throttling
  useEffect(() => {
    const listContainer = listContainerRef.current;
    if (!listContainer) return;
    
    // Use a throttled version of the scroll handler
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    listContainer.addEventListener('scroll', throttledScroll);
    
    return () => {
      listContainer.removeEventListener('scroll', throttledScroll);
    };
  }, [handleScroll]);
  
  // Show error state
  if (localError || messagesError) {
    const errorMessage = localError || messagesError;
    
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
    
    return (
      <ErrorState>
        <FiAlertCircle size={40} />
        <h3>Erreur lors du chargement des messages</h3>
        <p>{errorMessage || "Une erreur s'est produite lors de la récupération des messages."}</p>
        <StyledButton onClick={handleRetry}>
          <FiRefreshCw />
          Réessayer
        </StyledButton>
        <DebugInfo>ConvID: {conversationId}, Loaded: {hasInitiallyLoaded ? 'Yes' : 'No'}</DebugInfo>
      </ErrorState>
    );
  }
  
  // Show loading state for initial load
  if (isInitialLoad && messages.length === 0) {
    return (
      <EmptyState>
        <LoadingIndicator>
          <FiRefreshCw size={30} />
          <span>Chargement des messages...</span>
        </LoadingIndicator>
        <p>Veuillez patienter pendant que nous récupérons votre conversation de manière sécurisée.</p>
        <DebugInfo>ConvID: {conversationId}, Attempt: {hasAttemptedInitialLoadRef.current ? 'Yes' : 'No'}</DebugInfo>
      </EmptyState>
    );
  }
  
  // Show empty state if no messages
  if (!isInitialLoad && messages.length === 0) {
    return (
      <EmptyState>
        <h3>Aucun message pour le moment</h3>
        <p>Commencez la conversation en envoyant un message ci-dessous.</p>
        <EncryptionNote>
          <FiLock />
          <span>Tous les messages sont protégés par un chiffrement de bout en bout</span>
        </EncryptionNote>
        <DebugInfo>
          ConvID: {conversationId}, 
          Loaded: {hasInitiallyLoaded ? 'Yes' : 'No'},
          Count: {debugInfo.loadCount}
        </DebugInfo>
      </EmptyState>
    );
  }
  
  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    if (!message) return groups;
    
    try {
      const timestamp = message.timestamp || Date.now();
      const date = new Date(timestamp);
      
      // Check if date is valid
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
      // Use fallback date for problematic messages
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
      {/* Loading indicator for fetching older messages */}
      {isLoadingMore && (
        <LoadingIndicator style={{ padding: '10px 0' }}>
          <FiRefreshCw size={20} />
          <span>Chargement des messages...</span>
        </LoadingIndicator>
      )}
      
      {/* Button to scroll to new messages */}
      {hasNewMessages && (
        <NewMessagesButton onClick={scrollToBottom}>
          Nouveaux messages
          <FiChevronDown />
        </NewMessagesButton>
      )}
      
      {/* Render messages grouped by date */}
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
      
      {/* Loading indicator for non-initial refreshes */}
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
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiArrowLeftSLine, RiInformationLine } from 'react-icons/ri';

// Redux actions
import { fetchConversationMessages, setActiveConversation } from '../store/slices/messagesSlice';
import { fetchContacts } from '../store/slices/contactsSlice';
import { fetchGroups } from '../store/slices/groupsSlice';

// Components
import Avatar from '../components/ui/Avatar';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
`;

const ChatHeader = styled.header`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.elevation[2]};
  z-index: 10;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  margin-right: 8px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  & > svg {
    font-size: 24px;
  }
`;

const ContactInfo = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`;

const ContactDetails = styled.div`
  margin-left: 12px;
`;

const ContactName = styled.h2`
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
`;

const ContactStatus = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
`;

const InfoButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  & > svg {
    font-size: 22px;
  }
`;

const ChatContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-align: center;
  padding: 20px;
  
  h3 {
    color: ${({ theme }) => theme.colors.error};
    margin-bottom: 10px;
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    max-width: 500px;
    margin-bottom: 20px;
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

const Chat = () => {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { contacts } = useSelector((state) => state.contacts);
  const { groups } = useSelector((state) => state.groups);
  const { user } = useSelector((state) => state.auth);
  const { loading: messagesLoading, error: messagesError } = useSelector((state) => state.messages);
  
  const [conversation, setConversation] = useState(null);
  const [isGroup, setIsGroup] = useState(false);
  const [error, setError] = useState(null);
  
  // Fonction pour normaliser l'ID de conversation
  const normalizeConversationId = (rawId) => {
    // Vérifier si c'est déjà un ID de groupe
    if (rawId.startsWith('group:')) {
      return rawId;
    }
    
    // Vérifier si c'est un ID de conversation directe (format userId:userId)
    if (rawId.includes(':')) {
      const parts = rawId.split(':');
      if (parts.length === 2) {
        return parts.sort().join(':');
      }
    }
    
    // Si c'est un UUID ou autre format non reconnu, on le retourne tel quel
    // Le serveur a été modifié pour accepter temporairement ces formats
    console.warn(`Format d'ID de conversation non standard détecté: ${rawId}`);
    return rawId;
  };
  
  // Load contacts and groups if needed
  useEffect(() => {
    if (contacts.length === 0) {
      dispatch(fetchContacts());
    }
    if (groups.length === 0) {
      dispatch(fetchGroups());
    }
  }, [dispatch, contacts.length, groups.length]);
  
  // Set up the conversation details based on the conversationId
  useEffect(() => {
    if (!conversationId) return;
    
    // Réinitialiser les erreurs
    setError(null);
    
    // Normaliser l'ID de conversation
    const normalizedId = normalizeConversationId(conversationId);
    console.log('Setting up conversation:', normalizedId);
    
    // First, determine if this is a group conversation
    const groupChat = normalizedId.startsWith('group:');
    setIsGroup(groupChat);
    
    let currentConversation = null;
    
    if (groupChat) {
      // For group chats, extract the groupId and find the group
      const groupId = normalizedId.replace('group:', '');
      console.log('Looking for group with ID:', groupId);
      
      const group = groups.find(g => g.id === groupId);
      if (group) {
        console.log('Found group:', group.name);
        currentConversation = {
          ...group,
          isGroup: true
        };
      } else {
        console.log('Group not found in:', groups);
        // Ne pas définir d'erreur immédiatement, car les groupes peuvent être en cours de chargement
      }
    } else if (normalizedId.includes(':')) {
      // For direct chats, the conversation ID is the sorted user IDs joined with ':'
      if (user && contacts.length > 0) {
        // Find the other user's ID in the conversation
        const participants = normalizedId.split(':');
        console.log('Conversation participants:', participants, 'Current user:', user.id);
        
        const otherUserId = participants[0] === user.id ? participants[1] : participants[0];
        console.log('Looking for contact with ID:', otherUserId);
        
        // Find the contact with this ID
        const contact = contacts.find(c => c.id === otherUserId);
        if (contact) {
          console.log('Found contact:', contact.username);
          currentConversation = {
            ...contact,
            isGroup: false
          };
        } else {
          console.log('Contact not found in:', contacts.map(c => `${c.username}(${c.id})`));
          // Ne pas définir d'erreur immédiatement, car les contacts peuvent être en cours de chargement
        }
      }
    } else {
      // Format d'ID non standard (probablement un ancien UUID)
      console.log('Non-standard conversation ID format, will attempt to fetch anyway');
      // On ne définit pas d'erreur, on va essayer de récupérer quand même les messages
    }
    
    console.log('Setting conversation:', currentConversation);
    setConversation(currentConversation);
    
    // Set active conversation
    dispatch(setActiveConversation(normalizedId));
    
    // Fetch messages - capturing any errors
    console.log('Fetching messages for conversation:', normalizedId);
    dispatch(fetchConversationMessages(normalizedId))
      .unwrap()
      .then(result => {
        console.log('Messages fetch result:', result);
      })
      .catch(error => {
        console.error('Failed to fetch messages:', error);
        setError(error);
      });
    
    return () => {
      // Clear active conversation when unmounting
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch, groups, contacts, user]);
  
  const handleBack = () => {
    navigate('/');
  };
  
  const handleInfoClick = () => {
    // Would typically open a sidebar or modal with conversation details
    // For now we'll just log the information
    console.log('Conversation details:', conversation);
  };
  
  // Si nous avons une erreur d'accès à la conversation
  if (error && error.includes('Unauthorized access')) {
    return (
      <ChatContainer>
        <ChatHeader>
          <BackButton onClick={handleBack}>
            <RiArrowLeftSLine />
          </BackButton>
          <ContactInfo>
            <ContactName>Erreur d'accès</ContactName>
          </ContactInfo>
        </ChatHeader>
        
        <ErrorContainer>
          <h3>Impossible d'accéder à cette conversation</h3>
          <p>
            Vous n'avez pas les autorisations nécessaires pour accéder à cette conversation ou le format de l'identifiant est incorrect.
          </p>
          <button onClick={handleBack}>Retourner à l'accueil</button>
        </ErrorContainer>
      </ChatContainer>
    );
  }
  
  return (
    <ChatContainer>
      <ChatHeader>
        <BackButton onClick={handleBack}>
          <RiArrowLeftSLine />
        </BackButton>
        
        <ContactInfo>
          {conversation ? (
            <>
              <Avatar 
                name={conversation.displayName || conversation.name || conversation.username} 
                src={conversation.avatar}
                color={conversation.isGroup ? '#03dac6' : undefined}
              />
              <ContactDetails>
                <ContactName>
                  {conversation.displayName || conversation.name || conversation.username}
                </ContactName>
                <ContactStatus>
                  {conversation.isGroup 
                    ? `${conversation.members?.length || 0} members` 
                    : 'Online'} {/* Status would be dynamic in a real app */}
                </ContactStatus>
              </ContactDetails>
            </>
          ) : (
            <>
              <Avatar name="Unknown" />
              <ContactDetails>
                <ContactName>Conversation</ContactName>
                <ContactStatus>Loading...</ContactStatus>
              </ContactDetails>
            </>
          )}
        </ContactInfo>
        
        <InfoButton onClick={handleInfoClick}>
          <RiInformationLine />
        </InfoButton>
      </ChatHeader>
      
      <ChatContent>
        {messagesLoading && !conversation ? (
          <LoadingContainer>
            <p>Loading conversation...</p>
          </LoadingContainer>
        ) : (
          <>
            <MessageList conversationId={conversationId} />
            <MessageInput 
              conversationId={conversationId}
              recipientId={!isGroup && conversation ? conversation.id : null}
              groupId={isGroup && conversation ? conversation.id : null}
            />
          </>
        )}
      </ChatContent>
    </ChatContainer>
  );
};

export default Chat;
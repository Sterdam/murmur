import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiArrowLeftSLine, RiInformationLine, RiAlertCircleLine } from 'react-icons/ri';

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
  overflow: hidden;
`;

const ContactName = styled.h2`
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const ContactStatus = styled.div`
  font-size: 0.75rem;
  color: ${({ theme, online }) => online ? '#4caf50' : theme.colors.textSecondary};
  margin-top: 2px;
  display: flex;
  align-items: center;
  
  &::before {
    content: '';
    display: ${({ online }) => online ? 'block' : 'none'};
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #4caf50;
    margin-right: 4px;
  }
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
  position: relative;
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
  
  svg {
    font-size: 40px;
    color: ${({ theme }) => theme.colors.error};
    margin-bottom: 16px;
    opacity: 0.8;
  }
  
  h3 {
    color: ${({ theme }) => theme.colors.error};
    margin-bottom: 10px;
  }
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    max-width: 500px;
    margin-bottom: 20px;
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

const InfoPanel = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 300px;
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  z-index: 20;
  transform: translateX(${({ open }) => (open ? '0' : '100%')});
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  padding: 16px;
`;

const InfoPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  
  h3 {
    margin: 0;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Chat = () => {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { contacts, loading: contactsLoading } = useSelector((state) => state.contacts);
  const { groups, loading: groupsLoading } = useSelector((state) => state.groups);
  const { user } = useSelector((state) => state.auth);
  const { loading: messagesLoading, error: messagesError } = useSelector((state) => state.messages);
  
  const [conversation, setConversation] = useState(null);
  const [isGroup, setIsGroup] = useState(false);
  const [error, setError] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(false);
  
  const loadedRef = useRef(false);
  
  // Fonction memoïsée pour normaliser l'ID de conversation
  const normalizeConversationId = useCallback((rawId) => {
    if (!rawId) return '';
    
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
    
    console.warn(`Format d'ID de conversation non standard détecté: ${rawId}`);
    return rawId;
  }, []);
  
  // Load contacts and groups if needed
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      
      const loadData = async () => {
        try {
          // Charger les contacts si nécessaire
          if (contacts.length === 0 && !contactsLoading) {
            await dispatch(fetchContacts()).unwrap();
          }
          
          // Charger les groupes si nécessaire
          if (groups.length === 0 && !groupsLoading) {
            await dispatch(fetchGroups()).unwrap();
          }
        } catch (err) {
          console.error('Error loading initial data:', err);
        }
      };
      
      loadData();
    }
  }, [dispatch, contacts.length, groups.length, contactsLoading, groupsLoading]);
  
  // Configurer les détails de la conversation basés sur l'ID
  useEffect(() => {
    if (!conversationId) return;
    
    // Réinitialiser les erreurs
    setError(null);
    
    // Normaliser l'ID de conversation
    const normalizedId = normalizeConversationId(conversationId);
    
    // Déterminer si c'est une conversation de groupe
    const groupChat = normalizedId.startsWith('group:');
    setIsGroup(groupChat);
    
    let currentConversation = null;
    
    if (groupChat) {
      // Pour les conversations de groupe, extraire l'ID du groupe et trouver le groupe
      const groupId = normalizedId.replace('group:', '');
      
      const group = groups.find(g => g.id === groupId);
      if (group) {
        currentConversation = {
          ...group,
          isGroup: true
        };
      } else if (!groupsLoading && groups.length > 0) {
        // Si les groupes sont chargés mais aucun ne correspond, c'est une erreur
        console.error('Group not found:', groupId);
        setError('Groupe non trouvé ou vous n\'êtes pas membre');
      }
    } else if (normalizedId.includes(':')) {
      // Pour les conversations directes
      if (user && contacts.length > 0) {
        // Trouver l'ID de l'autre utilisateur dans la conversation
        const participants = normalizedId.split(':');
        const otherUserId = participants[0] === user.id ? participants[1] : participants[0];
        
        // Trouver le contact avec cet ID
        const contact = contacts.find(c => c.id === otherUserId);
        if (contact) {
          currentConversation = {
            ...contact,
            isGroup: false
          };
          
          // Simuler un statut en ligne aléatoire (pour démo)
          setOnlineStatus(Math.random() > 0.5);
        } else if (!contactsLoading && contacts.length > 0) {
          // Si les contacts sont chargés mais aucun ne correspond, c'est une erreur
          console.error('Contact not found:', otherUserId);
          setError('Contact non trouvé ou vous n\'êtes pas connecté avec cette personne');
        }
      }
    } else {
      // Format d'ID non standard
      console.warn('Non-standard conversation ID format, will attempt to fetch anyway');
      // Pour ces cas, on crée un objet de conversation "minimal"
      currentConversation = {
        id: normalizedId,
        name: "Conversation",
        isGroup: false
      };
    }
    
    setConversation(currentConversation);
    
    // Définir la conversation active dans Redux
    dispatch(setActiveConversation(normalizedId));
    
    // Charger les messages avec gestion d'erreur
    if (!messagesLoading) {
      dispatch(fetchConversationMessages(normalizedId))
        .unwrap()
        .catch(err => {
          console.error('Failed to fetch messages:', err);
          setError(err);
        });
    }
    
    return () => {
      // Effacer la conversation active au démontage
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch, groups, contacts, user, normalizeConversationId, groupsLoading, contactsLoading, messagesLoading]);
  
  // Mettre à jour l'erreur si une erreur Redux est détectée
  useEffect(() => {
    if (messagesError && !error) {
      setError(messagesError);
    }
  }, [messagesError, error]);
  
  const handleBack = () => {
    navigate('/');
  };
  
  const toggleInfoPanel = () => {
    setInfoOpen(!infoOpen);
  };
  
  // Si nous avons une erreur
  if (error) {
    let errorMessage = "Une erreur s'est produite";
    let errorDetails = "Impossible de charger cette conversation. Veuillez vérifier votre connexion et réessayer.";
    
    if (typeof error === 'string') {
      if (error.includes('Unauthorized access')) {
        errorMessage = "Accès non autorisé";
        errorDetails = "Vous n'avez pas les permissions nécessaires pour accéder à cette conversation ou l'identifiant est incorrect.";
      } else if (error.includes('not found') || error.includes('non trouvé')) {
        errorMessage = "Conversation introuvable";
        errorDetails = error;
      } else {
        errorDetails = error;
      }
    }
    
    return (
      <ChatContainer>
        <ChatHeader>
          <BackButton onClick={handleBack}>
            <RiArrowLeftSLine />
          </BackButton>
          <ContactInfo>
            <ContactName>Erreur</ContactName>
          </ContactInfo>
        </ChatHeader>
        
        <ErrorContainer>
          <RiAlertCircleLine />
          <h3>{errorMessage}</h3>
          <p>{errorDetails}</p>
          <StyledButton onClick={handleBack}>
            Retourner à l'accueil
          </StyledButton>
        </ErrorContainer>
      </ChatContainer>
    );
  }
  
  // Contenu du panneau d'information
  const renderInfoPanel = () => {
    if (!conversation) return null;
    
    return (
      <InfoPanel open={infoOpen}>
        <InfoPanelHeader>
          <h3>Informations</h3>
          <CloseButton onClick={toggleInfoPanel}>&times;</CloseButton>
        </InfoPanelHeader>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <Avatar 
            name={conversation.displayName || conversation.name || conversation.username} 
            src={conversation.avatar}
            color={conversation.isGroup ? '#03dac6' : undefined}
            size="large"
          />
          <h3 style={{ marginTop: '10px', marginBottom: '5px' }}>
            {conversation.displayName || conversation.name || conversation.username}
          </h3>
          {!isGroup && (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
              @{conversation.username}
            </p>
          )}
        </div>
        
        {isGroup && conversation.members && (
          <div>
            <h4>Membres ({conversation.members.length})</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {conversation.members.map(memberId => {
                const member = contacts.find(c => c.id === memberId) || { id: memberId, username: 'Inconnu' };
                return (
                  <div key={memberId} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <Avatar 
                      name={member.displayName || member.username} 
                      size="small"
                    />
                    <span style={{ marginLeft: '10px' }}>
                      {member.displayName || member.username}
                      {member.id === user?.id && ' (Vous)'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {!isGroup && (
          <div>
            <h4>Options</h4>
            <StyledButton style={{ width: '100%', marginTop: '10px' }}>
              Voir le profil
            </StyledButton>
          </div>
        )}
      </InfoPanel>
    );
  };
  
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
                <ContactStatus online={!isGroup && onlineStatus}>
                  {isGroup 
                    ? `${conversation.members?.length || 0} membres` 
                    : onlineStatus ? 'En ligne' : 'Hors ligne'}
                </ContactStatus>
              </ContactDetails>
            </>
          ) : (
            <>
              <Avatar name="..." />
              <ContactDetails>
                <ContactName>Chargement...</ContactName>
                <ContactStatus>Veuillez patienter</ContactStatus>
              </ContactDetails>
            </>
          )}
        </ContactInfo>
        
        <InfoButton onClick={toggleInfoPanel}>
          <RiInformationLine />
        </InfoButton>
      </ChatHeader>
      
      <ChatContent>
        {messagesLoading && !conversation ? (
          <LoadingContainer>
            <p>Chargement de la conversation...</p>
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
        
        {renderInfoPanel()}
      </ChatContent>
    </ChatContainer>
  );
};

export default Chat;
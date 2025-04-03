import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiArrowLeftSLine, RiInformationLine, RiCloseLine } from 'react-icons/ri';
import { FiAlertCircle, FiInfo, FiUserCheck, FiUsers } from 'react-icons/fi';

// Redux actions
import { fetchConversationMessages, setActiveConversation, normalizeConversationId } from '../store/slices/messagesSlice';
import { fetchContacts } from '../store/slices/contactsSlice';
import { fetchGroups } from '../store/slices/groupsSlice';

// Components
import Avatar from '../components/ui/Avatar';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import Button from '../components/ui/Button';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
  position: relative;
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
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MemberList = styled.div`
  max-height: 300px;
  overflow-y: auto;
`;

const MemberItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  span {
    margin-left: 10px;
  }
`;

const InfoSection = styled.div`
  margin-bottom: 20px;
`;

const InfoSectionTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Chat = () => {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Référence pour suivre les requêtes en cours
  const isLoadingRef = useRef(false);
  const initialDataLoaded = useRef(false);
  const dataFetchTimeoutRef = useRef(null);
  
  // Normaliser l'ID de conversation pour tout le composant
  const normalizedId = useMemo(() => {
    return conversationId ? normalizeConversationId(conversationId) : null;
  }, [conversationId]);
  
  // Sélecteurs Redux
  const { contacts, loading: contactsLoading } = useSelector((state) => state.contacts);
  const { groups, loading: groupsLoading } = useSelector((state) => state.groups);
  const { user } = useSelector((state) => state.auth);
  const { 
    loading: messagesLoading, 
    error: messagesError,
    conversations
  } = useSelector((state) => state.messages);
  
  // États locaux
  const [conversation, setConversation] = useState(null);
  const [isGroup, setIsGroup] = useState(false);
  const [error, setError] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Vérifier si les données existent déjà pour éviter des chargements inutiles
  const hasExistingMessages = useMemo(() => {
    if (!normalizedId || !conversations) return false;
    return Array.isArray(conversations[normalizedId]) && conversations[normalizedId].length > 0;
  }, [normalizedId, conversations]);
  
  // Charger les contacts et groupes si nécessaire - une seule fois
  useEffect(() => {
    if (initialDataLoaded.current) return;
    
    const loadInitialData = async () => {
      try {
        // Charger les contacts si nécessaire
        if (contacts.length === 0 && !contactsLoading) {
          await dispatch(fetchContacts()).unwrap();
        }
        
        // Charger les groupes si nécessaire
        if (groups.length === 0 && !groupsLoading) {
          await dispatch(fetchGroups()).unwrap();
        }
        
        setInitialLoadComplete(true);
        initialDataLoaded.current = true;
      } catch (err) {
        console.error("Erreur lors du chargement des données initiales:", err);
        setError("Erreur lors du chargement des données initiales");
      }
    };
    
    loadInitialData();
  }, [dispatch, contacts.length, groups.length, contactsLoading, groupsLoading]);
  
  // Configurer la conversation basée sur l'ID
  useEffect(() => {
    if (!conversationId || !normalizedId) return;
    
    // Réinitialiser les erreurs
    setError(null);
    
    // Déterminer si c'est une conversation de groupe
    const groupChat = normalizedId.startsWith('group:');
    setIsGroup(groupChat);
    
    // Définir la conversation active dans Redux
    dispatch(setActiveConversation(normalizedId));
    
    // Nettoyage lors du démontage
    return () => {
      dispatch(setActiveConversation(null));
    };
  }, [normalizedId, dispatch, conversationId]);
  
  // Configurer les détails de la conversation après le chargement des données
  useEffect(() => {
    if (!conversationId || !user || !initialLoadComplete) return;
    
    let currentConversation = null;
    
    if (isGroup) {
      // Pour les conversations de groupe, extraire l'ID du groupe
      const groupId = normalizedId.replace('group:', '');
      
      const group = groups.find(g => g.id === groupId);
      if (group) {
        currentConversation = {
          ...group,
          isGroup: true
        };
      } else if (!groupsLoading && groups.length > 0) {
        setError('Groupe non trouvé ou vous n\'êtes pas membre');
      }
    } else if (normalizedId && normalizedId.includes(':')) {
      // Pour les conversations directes
      if (user && contacts.length > 0) {
        // Trouver l'ID de l'autre utilisateur
        const participants = normalizedId.split(':');
        const otherUserId = participants[0] === user.id ? participants[1] : participants[0];
        
        // Trouver le contact
        const contact = contacts.find(c => c.id === otherUserId);
        if (contact) {
          currentConversation = {
            ...contact,
            isGroup: false
          };
          
          // Simuler un statut en ligne aléatoire (pour démo)
          setOnlineStatus(Math.random() > 0.5);
        } else if (!contactsLoading && contacts.length > 0) {
          setError('Contact non trouvé ou vous n\'êtes pas connecté avec cette personne');
        }
      }
    } else if (normalizedId) {
      // Format d'ID non standard
      currentConversation = {
        id: normalizedId,
        name: "Conversation",
        isGroup: false,
        username: "Utilisateur"
      };
    }
    
    setConversation(currentConversation);
    
  }, [normalizedId, isGroup, user, contacts, groups, conversationId, contactsLoading, groupsLoading, initialLoadComplete]);
  
  // Mettre à jour l'erreur si une erreur Redux est détectée
  useEffect(() => {
    if (messagesError && !error) {
      setError(messagesError);
    }
  }, [messagesError, error]);
  
  // Naviguer vers la page d'accueil
  const handleBack = () => {
    navigate('/');
  };
  
  // Afficher/masquer le panneau d'information
  const toggleInfoPanel = () => {
    setInfoOpen(!infoOpen);
  };
  
  // Récupérer le contact actuel pour l'affichage du profil
  const getCurrentContact = useCallback(() => {
    if (!conversation || isGroup) return null;
    
    return contacts.find(c => c.id === conversation.id) || conversation;
  }, [conversation, contacts, isGroup]);
  
  // Afficher un état d'erreur
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
          <FiAlertCircle />
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
          <CloseButton onClick={toggleInfoPanel}>
            <RiCloseLine />
          </CloseButton>
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
          <InfoSection>
            <InfoSectionTitle>
              <FiUsers style={{ marginRight: '5px' }} />
              Membres ({conversation.members.length})
            </InfoSectionTitle>
            <MemberList>
              {conversation.members.map(memberId => {
                const member = contacts.find(c => c.id === memberId) || { id: memberId, username: 'Inconnu' };
                return (
                  <MemberItem key={memberId}>
                    <Avatar 
                      name={member.displayName || member.username} 
                      size="small"
                    />
                    <span>
                      {member.displayName || member.username}
                      {member.id === user?.id && ' (Vous)'}
                    </span>
                  </MemberItem>
                );
              })}
            </MemberList>
          </InfoSection>
        )}
        
        {!isGroup && (
          <InfoSection>
            <InfoSectionTitle>Options</InfoSectionTitle>
            <Button 
              variant="contained" 
              fullWidth
              startIcon={<FiUserCheck />}
              style={{ marginTop: '10px' }}
            >
              Voir le profil
            </Button>
          </InfoSection>
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
            <MessageList conversationId={normalizedId} />
            <MessageInput 
              conversationId={normalizedId}
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
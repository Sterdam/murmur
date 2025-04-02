// client/src/pages/Contacts.js - Version complète
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { 
  FiPlus, 
  FiSearch, 
  FiMessageSquare, 
  FiUserPlus, 
  FiAlertCircle, 
  FiUserX, 
  FiUserCheck, 
  FiClock,
  FiRefreshCw
} from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// Store & Services
import { 
  fetchContacts, 
  fetchContactRequests,
  sendContactRequest, 
  acceptContactRequest, 
  rejectContactRequest,
  clearContactError,
  clearRequestError, 
  clearRequestSuccess
} from '../store/slices/contactsSlice';
import { setActiveConversation } from '../store/slices/messagesSlice';

// Styles
const ContactsContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 32px 16px;
`;

const ContactsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  
  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
`;

const HeaderLeft = styled.div``;

const ContactsTitle = styled.h1`
  ${({ theme }) => theme.typography.h4};
  margin: 0;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ContactsDescription = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  display: flex;
  align-items: center;
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 24px;
  overflow-x: auto;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 12px 20px;
  color: ${({ active, theme }) => active ? theme.colors.primary : theme.colors.textSecondary};
  font-weight: ${({ active }) => active ? '500' : '400'};
  cursor: pointer;
  border-bottom: 2px solid ${({ active, theme }) => active ? theme.colors.primary : 'transparent'};
  transition: all 0.3s;
  display: flex;
  align-items: center;
  white-space: nowrap;
  
  &:hover {
    color: ${({ active, theme }) => active ? theme.colors.primary : theme.colors.textPrimary};
  }
  
  svg {
    margin-right: 8px;
  }
`;

const TabBadge = styled.span`
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  border-radius: 12px;
  font-size: 0.75rem;
  padding: 2px 6px;
  margin-left: 8px;
  min-width: 20px;
  text-align: center;
`;

const SearchContainer = styled.div`
  margin-bottom: 24px;
`;

const ContactsList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  
  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 960px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const ContactCard = styled(Card)`
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.elevation[4]};
  }
`;

const ContactInfo = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
`;

const ContactDetails = styled.div`
  margin-left: 16px;
  flex: 1;
  overflow: hidden;
`;

const ContactName = styled.h3`
  ${({ theme }) => theme.typography.subtitle1};
  margin: 0;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ContactStatus = styled.p`
  ${({ theme, pending, accepted, rejected }) => {
    if (pending) return `color: ${theme.colors.secondary};`;
    if (accepted) return `color: #4caf50;`;
    if (rejected) return `color: ${theme.colors.error};`;
    return `color: ${theme.colors.textSecondary};`;
  }};
  margin: 0;
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  
  svg {
    margin-right: 4px;
  }
`;

const ContactActions = styled.div`
  display: flex;
  padding: 8px 16px 16px;
  gap: 8px;
  justify-content: space-between;
`;

const AddContactForm = styled.div`
  margin-bottom: 24px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 0;
  text-align: center;
`;

const EmptyStateText = styled.p`
  ${({ theme }) => theme.typography.body1};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 16px 0;
  max-width: 360px;
`;

const SuccessMessage = styled.div`
  background-color: rgba(76, 175, 80, 0.1);
  color: #4caf50;
  padding: 10px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
    flex-shrink: 0;
  }
`;

const ErrorMessage = styled.div`
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  padding: 10px 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
    flex-shrink: 0;
  }
`;

const HelpText = styled.div`
  margin-top: 16px;
  padding: 12px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.05);
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const RefreshButton = styled(Button)`
  margin-left: 10px;
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
  
  svg {
    animation: spin 1s linear infinite;
    margin-right: 8px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const DebugInfo = styled.div`
  margin-top: 16px;
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
  white-space: pre-wrap;
  display: ${({ visible }) => visible ? 'block' : 'none'};
`;

const Contacts = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Redux selectors
  const { 
    contacts, 
    incomingRequests, 
    outgoingRequests, 
    loading, 
    requestLoading,
    error, 
    requestError,
    requestSuccess 
  } = useSelector((state) => state.contacts);
  const { user } = useSelector((state) => state.auth);
  
  // Local state
  const [activeTab, setActiveTab] = useState('contacts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  
  // Charger les contacts et les demandes au chargement initial ET toutes les 30 secondes
  useEffect(() => {
    // Chargement initial
    loadContactData();
    
    // Rafraîchissement automatique toutes les 30 secondes
    const intervalId = setInterval(() => {
      loadContactData(false); // false = ne pas afficher le loading
    }, 30000);
    
    // Nettoyage lors du démontage du composant
    return () => {
      clearInterval(intervalId);
      // Nettoyer les erreurs et les notifications de succès
      dispatch(clearContactError());
      dispatch(clearRequestError());
      dispatch(clearRequestSuccess());
    };
  }, [dispatch]);
  
  // Charger l'onglet des demandes entrantes par défaut s'il y en a
  useEffect(() => {
    if (incomingRequests && incomingRequests.length > 0 && activeTab === 'contacts') {
      setActiveTab('incoming');
    }
  }, [incomingRequests, activeTab]);
  
  const loadContactData = (showLoading = true) => {
    if (showLoading) {
      // Si nous voulons afficher l'indicateur de chargement
      dispatch(fetchContacts());
      dispatch(fetchContactRequests());
    } else {
      // Chargement silencieux
      dispatch(fetchContacts()).catch(err => console.error('Error refreshing contacts:', err));
      dispatch(fetchContactRequests()).catch(err => console.error('Error refreshing requests:', err));
    }
    setLastRefresh(Date.now());
  };
  
  // Obtenir les éléments filtrés en fonction du terme de recherche
  const getFilteredItems = () => {
    let itemsToFilter = [];
    
    if (activeTab === 'contacts') {
      itemsToFilter = contacts || [];
    } else if (activeTab === 'incoming') {
      itemsToFilter = incomingRequests || [];
    } else if (activeTab === 'outgoing') {
      itemsToFilter = outgoingRequests || [];
    }
    
    // Vérifier si itemsToFilter est un tableau
    if (!Array.isArray(itemsToFilter)) {
      console.error(`Items to filter is not an array:`, itemsToFilter);
      return [];
    }
    
    return itemsToFilter.filter(item => {
      if (!item) return false;
      
      const searchFields = [];
      
      // Ajouter les champs qui peuvent être recherchés
      if (item.username) searchFields.push(item.username.toLowerCase());
      if (item.displayName) searchFields.push(item.displayName.toLowerCase());
      if (item.senderUsername) searchFields.push(item.senderUsername.toLowerCase());
      if (item.recipientUsername) searchFields.push(item.recipientUsername.toLowerCase());
      
      // Si aucun champ de recherche n'est disponible, ne pas filtrer cet élément
      if (searchFields.length === 0) return true;
      
      // Vérifier si l'un des champs contient le terme de recherche
      return searchFields.some(field => field.includes(searchTerm.toLowerCase()));
    });
  };
  
  const filteredItems = getFilteredItems();
  
  // Handler pour l'envoi d'une demande de contact
  const handleSendContactRequest = async () => {
    if (!newContactUsername.trim()) return;
    
    try {
      await dispatch(sendContactRequest(newContactUsername.trim())).unwrap();
      
      // Ne pas effacer le champ pour permettre d'envoyer plusieurs demandes
      // setNewContactUsername('');
      
      // Rafraîchir les données après l'envoi
      setTimeout(() => {
        loadContactData();
      }, 1000); // Petit délai pour laisser le serveur traiter la demande
    } catch (error) {
      console.error('Failed to send contact request:', error);
    }
  };
  
  // Handler pour accepter une demande de contact
  const handleAcceptRequest = async (requestId) => {
    try {
      await dispatch(acceptContactRequest(requestId)).unwrap();
      
      // Rafraîchir immédiatement pour mettre à jour l'interface
      setTimeout(() => {
        loadContactData();
      }, 500); // Petit délai pour laisser le serveur traiter la demande
    } catch (error) {
      console.error('Failed to accept contact request:', error);
    }
  };
  
  // Handler pour rejeter une demande de contact
  const handleRejectRequest = async (requestId) => {
    try {
      await dispatch(rejectContactRequest(requestId)).unwrap();
      
      // Rafraîchir immédiatement pour mettre à jour l'interface
      setTimeout(() => {
        loadContactData();
      }, 500); // Petit délai pour laisser le serveur traiter la demande
    } catch (error) {
      console.error('Failed to reject contact request:', error);
    }
  };
  
  // Handler pour ouvrir une conversation avec un contact
  const handleOpenChat = (contact) => {
    if (!contact || !contact.id) {
      console.error('Invalid contact or missing ID', contact);
      return;
    }
    
    // Créer l'ID de conversation en triant les IDs par ordre alphabétique
    if (!user || !user.id) {
      console.error('User data not available');
      return;
    }
    
    const conversationId = [user.id, contact.id].sort().join(':');
    
    // Définir la conversation active
    dispatch(setActiveConversation(conversationId));
    
    // Naviguer vers la page de chat
    navigate(`/chat/${conversationId}`);
  };
  
  // Handler pour changer l'onglet actif
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm(''); // Effacer la recherche lors d'un changement d'onglet
  };
  
  // Handler pour fermer le formulaire d'ajout
  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setNewContactUsername('');
    dispatch(clearRequestError());
    dispatch(clearRequestSuccess());
  };
  
  // Rafraîchir manuellement les données de contact
  const handleRefresh = () => {
    loadContactData(true);
  };
  
  // Toggle pour afficher les informations de débogage
  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
  };
  
  // Format de la date de dernier rafraîchissement
  const formatRefreshTime = () => {
    const date = new Date(lastRefresh);
    return date.toLocaleTimeString();
  };
  
  return (
    <ContactsContainer>
      <ContactsHeader>
        <HeaderLeft>
          <ContactsTitle>Contacts</ContactsTitle>
          <ContactsDescription>
            Manage your contacts and requests
            <RefreshButton 
              variant="text" 
              size="small" 
              onClick={handleRefresh} 
              startIcon={loading || requestLoading ? 
                <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : 
                <FiRefreshCw />
              }
              disabled={loading || requestLoading}
            >
              {loading || requestLoading ? 'Refreshing...' : 'Refresh'}
            </RefreshButton>
            <span style={{ fontSize: '0.75rem', marginLeft: '8px', opacity: 0.6 }}>
              Last: {formatRefreshTime()}
            </span>
          </ContactsDescription>
        </HeaderLeft>
        <Button 
          variant="contained" 
          startIcon={<FiPlus />}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          Add Contact
        </Button>
      </ContactsHeader>
      
      {showAddForm && (
        <AddContactForm>
          <Card>
            <CardHeader divider>
              <CardTitle>Add New Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {requestSuccess && (
                <SuccessMessage>
                  <FiUserCheck size={18} />
                  <span>Contact request sent successfully!</span>
                </SuccessMessage>
              )}
              
              {requestError && (
                <ErrorMessage>
                  <FiAlertCircle size={18} />
                  <span>{requestError}</span>
                </ErrorMessage>
              )}
              
              <TextField
                label="Username"
                placeholder="Enter username to add"
                value={newContactUsername}
                onChange={(e) => {
                  setNewContactUsername(e.target.value);
                  if (requestError) dispatch(clearRequestError());
                }}
                fullWidth
                error={!!requestError}
              />
              
              <HelpText>
                Enter the exact username of the person you want to add to your contacts.
                The person will receive a contact request that they can accept or reject.
              </HelpText>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button
                  variant="outlined"
                  onClick={handleCloseAddForm}
                  style={{ marginRight: '12px' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSendContactRequest}
                  disabled={requestLoading || !newContactUsername.trim()}
                  startIcon={<FiUserPlus />}
                >
                  {requestLoading ? 'Sending...' : 'Send Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AddContactForm>
      )}
      
      <TabsContainer>
        <Tab 
          active={activeTab === 'contacts'} 
          onClick={() => handleTabChange('contacts')}
        >
          <FiUserCheck /> Contacts
          <TabBadge>{contacts?.length || 0}</TabBadge>
        </Tab>
        <Tab 
          active={activeTab === 'incoming'} 
          onClick={() => handleTabChange('incoming')}
        >
          <FiUserPlus /> Incoming Requests
          {incomingRequests && incomingRequests.length > 0 && (
            <TabBadge>{incomingRequests.length}</TabBadge>
          )}
        </Tab>
        <Tab 
          active={activeTab === 'outgoing'} 
          onClick={() => handleTabChange('outgoing')}
        >
          <FiClock /> Outgoing Requests
          {outgoingRequests && outgoingRequests.length > 0 && (
            <TabBadge>{outgoingRequests.length}</TabBadge>
          )}
        </Tab>
        <Tab 
          active={false} 
          onClick={toggleDebugInfo}
          style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '0.75rem', padding: '4px 8px' }}
        >
          Debug
        </Tab>
      </TabsContainer>
      
      <SearchContainer>
        <TextField
          fullWidth
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startAdornment={<FiSearch />}
        />
      </SearchContainer>
      
      {/* Debug information */}
      <DebugInfo visible={showDebugInfo}>
        <div>Last refresh: {new Date(lastRefresh).toLocaleString()}</div>
        <div>Contacts: {JSON.stringify(contacts?.length || 0)}</div>
        <div>Incoming requests: {JSON.stringify(incomingRequests?.length || 0)}</div>
        <div>Outgoing requests: {JSON.stringify(outgoingRequests?.length || 0)}</div>
        <div>Loading: {JSON.stringify(loading)}</div>
        <div>Request loading: {JSON.stringify(requestLoading)}</div>
        <div>Error: {JSON.stringify(error)}</div>
        <div>Request error: {JSON.stringify(requestError)}</div>
        <div>First incoming request: {JSON.stringify(incomingRequests?.[0] || null)}</div>
      </DebugInfo>
      
      {(loading || requestLoading) && filteredItems.length === 0 ? (
        <EmptyState>
          <LoadingIndicator>
            <FiRefreshCw size={24} />
            <p>Loading...</p>
          </LoadingIndicator>
        </EmptyState>
      ) : filteredItems.length > 0 ? (
        <ContactsList>
          {filteredItems.map(item => (
            <ContactCard key={item.id} elevation={1}>
              <ContactInfo>
                <Avatar 
                  // Utiliser différentes propriétés selon le type de demande
                  src={item.avatar} 
                  name={
                    activeTab === 'incoming' 
                      ? item.senderUsername || item.username
                      : item.displayName || item.username
                  }
                />
                <ContactDetails>
                  <ContactName>
                    {activeTab === 'incoming' 
                      ? item.senderUsername || item.username
                      : item.displayName || item.username
                    }
                  </ContactName>
                  
                  {activeTab === 'contacts' && (
                    <ContactStatus accepted>
                      <FiUserCheck /> Connected
                    </ContactStatus>
                  )}
                  
                  {activeTab === 'incoming' && (
                    <ContactStatus pending>
                      <FiUserPlus /> Wants to connect
                    </ContactStatus>
                  )}
                  
                  {activeTab === 'outgoing' && (
                    <ContactStatus pending>
                      <FiClock /> Pending acceptance
                    </ContactStatus>
                  )}
                </ContactDetails>
              </ContactInfo>
              
              <CardFooter>
                {activeTab === 'contacts' && (
                  <Button
                    variant="outlined"
                    startIcon={<FiMessageSquare />}
                    onClick={() => handleOpenChat(item)}
                    fullWidth
                  >
                    Message
                  </Button>
                )}
                
                {activeTab === 'incoming' && (
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<FiUserX />}
                      onClick={() => handleRejectRequest(item.id)}
                      disabled={requestLoading}
                      style={{ flex: 1 }}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<FiUserCheck />}
                      onClick={() => handleAcceptRequest(item.id)}
                      disabled={requestLoading}
                      style={{ flex: 1 }}
                    >
                      Accept
                    </Button>
                  </div>
                )}
                
                {activeTab === 'outgoing' && (
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', textAlign: 'center', width: '100%' }}>
                    Waiting for user to accept your request
                  </div>
                )}
              </CardFooter>
            </ContactCard>
          ))}
        </ContactsList>
      ) : (
        <EmptyState>
          {activeTab === 'contacts' && (
            <>
              <FiUserCheck size={48} style={{ opacity: 0.5 }} />
              <EmptyStateText>
                {searchTerm ? 'No contacts matching your search' : 'You don\'t have any contacts yet'}
              </EmptyStateText>
              <Button
                variant="contained"
                onClick={() => {
                  setShowAddForm(true);
                  setSearchTerm('');
                }}
                startIcon={<FiPlus />}
              >
                Add Your First Contact
              </Button>
            </>
          )}
          
          {activeTab === 'incoming' && (
            <>
              <FiUserPlus size={48} style={{ opacity: 0.5 }} />
              <EmptyStateText>
                {searchTerm ? 'No requests matching your search' : 'No pending contact requests'}
              </EmptyStateText>
            </>
          )}
          
          {activeTab === 'outgoing' && (
            <>
              <FiClock size={48} style={{ opacity: 0.5 }} />
              <EmptyStateText>
                {searchTerm ? 'No requests matching your search' : 'You haven\'t sent any contact requests'}
              </EmptyStateText>
              <Button
                variant="contained"
                onClick={() => {
                  setShowAddForm(true);
                  setSearchTerm('');
                }}
                startIcon={<FiPlus />}
              >
                Send a Contact Request
              </Button>
            </>
          )}
        </EmptyState>
      )}
    </ContactsContainer>
  );
};

export default Contacts;
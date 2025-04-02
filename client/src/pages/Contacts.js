// client/src/pages/Contacts.js
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
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  margin-bottom: 24px;
  overflow-x: auto;
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
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
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
`;

const ContactName = styled.h3`
  ${({ theme }) => theme.typography.subtitle1};
  margin: 0;
  margin-bottom: 4px;
`;

const ContactStatus = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme, pending, accepted, rejected }) => {
    if (pending) return theme.colors.secondary;
    if (accepted) return '#4caf50';
    if (rejected) return theme.colors.error;
    return theme.colors.textSecondary;
  }};
  margin: 0;
  display: flex;
  align-items: center;
  
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
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
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
`;

const RefreshButton = styled(Button)`
  margin-left: 10px;
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
  
  // Load contacts and requests when the component mounts
  useEffect(() => {
    dispatch(fetchContacts());
    dispatch(fetchContactRequests());
  }, [dispatch]);
  
  // Get filtered contacts based on search term
  const getFilteredItems = () => {
    let itemsToFilter = [];
    
    if (activeTab === 'contacts') {
      itemsToFilter = contacts;
    } else if (activeTab === 'incoming') {
      itemsToFilter = incomingRequests;
    } else if (activeTab === 'outgoing') {
      itemsToFilter = outgoingRequests;
    }
    
    return itemsToFilter.filter(item => 
      item.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.displayName && item.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };
  
  const filteredItems = getFilteredItems();
  
  // Handle sending a contact request
  const handleSendContactRequest = async () => {
    if (!newContactUsername.trim()) return;
    
    try {
      await dispatch(sendContactRequest(newContactUsername.trim())).unwrap();
      setNewContactUsername('');
      
      // Don't auto-hide the form in case user wants to add more contacts
    } catch (error) {
      console.error('Failed to send contact request:', error);
    }
  };
  
  // Handle accepting a contact request
  const handleAcceptRequest = async (requestId) => {
    try {
      await dispatch(acceptContactRequest(requestId)).unwrap();
      // Automatically refresh contacts after accepting
      dispatch(fetchContacts());
    } catch (error) {
      console.error('Failed to accept contact request:', error);
    }
  };
  
  // Handle rejecting a contact request
  const handleRejectRequest = async (requestId) => {
    try {
      await dispatch(rejectContactRequest(requestId)).unwrap();
    } catch (error) {
      console.error('Failed to reject contact request:', error);
    }
  };
  
  // Handle opening chat with a contact
  const handleOpenChat = (contact) => {
    if (!contact || !contact.id) return;
    
    // Create conversation ID by sorting the IDs alphabetically
    if (!user || !user.id) {
      console.error('User data not available');
      return;
    }
    
    const conversationId = [user.id, contact.id].sort().join(':');
    
    // Set active conversation
    dispatch(setActiveConversation(conversationId));
    
    // Navigate to chat
    navigate(`/chat/${conversationId}`);
  };
  
  // Handle changing the active tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm(''); // Clear search when changing tabs
  };
  
  // Handle closing the add contact form
  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setNewContactUsername('');
    dispatch(clearRequestError());
    dispatch(clearRequestSuccess());
  };
  
  // Clear any errors when unmounting the component
  useEffect(() => {
    return () => {
      dispatch(clearContactError());
      dispatch(clearRequestError());
    };
  }, [dispatch]);
  
  // Clear success message after a delay
  useEffect(() => {
    if (requestSuccess) {
      const timer = setTimeout(() => {
        dispatch(clearRequestSuccess());
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [requestSuccess, dispatch]);
  
  // Refresh contact data
  const handleRefresh = () => {
    dispatch(fetchContacts());
    dispatch(fetchContactRequests());
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
              startIcon={<FiRefreshCw />}
              disabled={loading || requestLoading}
            >
              Refresh
            </RefreshButton>
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
        </Tab>
        <Tab 
          active={activeTab === 'incoming'} 
          onClick={() => handleTabChange('incoming')}
        >
          <FiUserPlus /> Incoming Requests
          {incomingRequests.length > 0 && (
            <TabBadge>{incomingRequests.length}</TabBadge>
          )}
        </Tab>
        <Tab 
          active={activeTab === 'outgoing'} 
          onClick={() => handleTabChange('outgoing')}
        >
          <FiClock /> Outgoing Requests
          {outgoingRequests.length > 0 && (
            <TabBadge>{outgoingRequests.length}</TabBadge>
          )}
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
      
      {(loading || requestLoading) && filteredItems.length === 0 ? (
        <EmptyState>
          <p>Loading...</p>
        </EmptyState>
      ) : filteredItems.length > 0 ? (
        <ContactsList>
          {filteredItems.map(item => (
            <ContactCard key={item.id} elevation={1}>
              <ContactInfo>
                <Avatar 
                  src={item.avatar} 
                  name={item.displayName || item.username} 
                />
                <ContactDetails>
                  <ContactName>{item.displayName || item.username}</ContactName>
                  
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
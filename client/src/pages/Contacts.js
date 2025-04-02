// client/src/pages/Contacts.js - Corrigé
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiPlus, FiSearch, FiMessageSquare, FiUserPlus, FiAlertCircle } from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// Store & Services
import { fetchContacts, addContact, clearError } from '../store/slices/contactsSlice';
import { setActiveConversation } from '../store/slices/messagesSlice';

const ContactsContainer = styled.div`
  max-width: 800px;
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
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const ContactActions = styled.div`
  display: flex;
  padding: 8px 16px 16px;
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

const Contacts = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { contacts, loading, error } = useSelector((state) => state.contacts);
  const { user } = useSelector((state) => state.auth);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [addStatus, setAddStatus] = useState({ loading: false, error: null, success: false });
  
  useEffect(() => {
    dispatch(fetchContacts());
  }, [dispatch]);
  
  const filteredContacts = contacts.filter(contact => 
    contact.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.displayName && contact.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const handleAddContact = async () => {
    if (!newContactUsername.trim()) return;
    
    try {
      setAddStatus({ loading: true, error: null, success: false });
      
      // Assurez-vous que le token est valide avant de faire la requête
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }
      
      // On utilise unwrap() pour obtenir directement le résultat ou l'erreur
      await dispatch(addContact(newContactUsername.trim())).unwrap();
      
      setAddStatus({ loading: false, error: null, success: true });
      setNewContactUsername('');
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setAddStatus(prev => ({ ...prev, success: false }));
        setShowAddForm(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error adding contact:', error);
      let errorMessage = '';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Failed to add contact. Please try again later.';
      }
      
      setAddStatus({ 
        loading: false, 
        error: errorMessage, 
        success: false 
      });
    }
  };
  
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
  
  // Clear any errors when unmounting
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);
  
  return (
    <ContactsContainer>
      <ContactsHeader>
        <HeaderLeft>
          <ContactsTitle>Contacts</ContactsTitle>
          <ContactsDescription>Manage your contacts and connections</ContactsDescription>
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
              {addStatus.success && (
                <SuccessMessage>
                  Contact added successfully!
                </SuccessMessage>
              )}
              
              {(error || addStatus.error) && (
                <ErrorMessage>
                  <FiAlertCircle size={18} />
                  <span>{error || addStatus.error}</span>
                </ErrorMessage>
              )}
              
              <TextField
                label="Username"
                placeholder="Enter username to add"
                value={newContactUsername}
                onChange={(e) => {
                  setNewContactUsername(e.target.value);
                  if (error) dispatch(clearError());
                  if (addStatus.error) setAddStatus(prev => ({ ...prev, error: null }));
                }}
                fullWidth
                error={!!error || !!addStatus.error}
              />
              
              <HelpText>
                Enter the exact username of the person you want to add to your contacts.
                Make sure they already have a Murmur account.
              </HelpText>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddStatus({ loading: false, error: null, success: false });
                    dispatch(clearError());
                  }}
                  style={{ marginRight: '12px' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAddContact}
                  disabled={addStatus.loading || !newContactUsername.trim()}
                  startIcon={<FiUserPlus />}
                >
                  {addStatus.loading ? 'Adding...' : 'Add Contact'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AddContactForm>
      )}
      
      <SearchContainer>
        <TextField
          fullWidth
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startAdornment={<FiSearch />}
        />
      </SearchContainer>
      
      {loading ? (
        <EmptyState>
          <p>Loading contacts...</p>
        </EmptyState>
      ) : filteredContacts.length > 0 ? (
        <ContactsList>
          {filteredContacts.map(contact => (
            <ContactCard key={contact.id || Math.random()} elevation={1}>
              <ContactInfo>
                <Avatar 
                  src={contact.avatar} 
                  name={contact.displayName || contact.username} 
                />
                <ContactDetails>
                  <ContactName>{contact.displayName || contact.username}</ContactName>
                  <ContactStatus>
                    {contact.status || 'Available'}
                  </ContactStatus>
                </ContactDetails>
              </ContactInfo>
              <CardFooter>
                <Button
                  variant="outlined"
                  startIcon={<FiMessageSquare />}
                  onClick={() => handleOpenChat(contact)}
                  fullWidth
                >
                  Message
                </Button>
              </CardFooter>
            </ContactCard>
          ))}
        </ContactsList>
      ) : (
        <EmptyState>
          <FiUserPlus size={48} style={{ opacity: 0.5 }} />
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
        </EmptyState>
      )}
    </ContactsContainer>
  );
};

export default Contacts;
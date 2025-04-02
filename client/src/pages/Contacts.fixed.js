import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { FiPlus, FiSearch, FiMessageSquare } from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// Store & Services
import { fetchContacts, addContact } from '../store/slices/contactsSlice';

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

const Contacts = () => {
  const dispatch = useDispatch();
  const { contacts, loading } = useSelector((state) => state.contacts);
  
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
      
      await dispatch(addContact(newContactUsername)).unwrap();
      
      setAddStatus({ loading: false, error: null, success: true });
      setNewContactUsername('');
      setShowAddForm(false);
      
    } catch (error) {
      setAddStatus({ 
        loading: false, 
        error: error.message || 'Failed to add contact', 
        success: false 
      });
    }
  };
  
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
              <TextField
                label="Username"
                placeholder="Enter username to add"
                value={newContactUsername}
                onChange={(e) => setNewContactUsername(e.target.value)}
                fullWidth
                error={!!addStatus.error}
                helperText={addStatus.error}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowAddForm(false)}
                  style={{ marginRight: '12px' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAddContact}
                  disabled={addStatus.loading || !newContactUsername.trim()}
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
                  online={contact.online}
                />
                <ContactDetails>
                  <ContactName>{contact.displayName || contact.username}</ContactName>
                  <ContactStatus>
                    {contact.online ? 'Online' : 'Offline'}
                  </ContactStatus>
                </ContactDetails>
              </ContactInfo>
              <ContactActions>
                <Button
                  variant="outlined"
                  startIcon={<FiMessageSquare />}
                  fullWidth
                >
                  Message
                </Button>
              </ContactActions>
            </ContactCard>
          ))}
        </ContactsList>
      ) : (
        <EmptyState>
          <FiPlus size={48} style={{ opacity: 0.5 }} />
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
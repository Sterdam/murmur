import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { fetchContacts } from '../store/slices/contactsSlice';
import { fetchGroups } from '../store/slices/groupsSlice';
import { logout } from '../store/slices/authSlice';
import { RiSettings4Line, RiUser3Line, RiTeamLine, RiLogoutBoxLine, RiMessage2Line } from 'react-icons/ri';

// Components
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import ConversationList from '../components/chat/ConversationList';

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.elevation[2]};
  z-index: 10;
`;

const Logo = styled.h1`
  color: ${({ theme }) => theme.colors.primary};
  font-size: 1.5rem;
  margin: 0;
`;

const ProfileSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Username = styled.span`
  font-weight: 500;
`;

const MainContent = styled.main`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const Sidebar = styled.aside`
  width: 64px;
  background-color: ${({ theme }) => theme.colors.surface};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  gap: 24px;
  box-shadow: ${({ theme }) => theme.elevation[2]};
  z-index: 5;
`;

const SidebarButton = styled(Button)`
  padding: 12px;
  border-radius: 50%;
  min-width: 0;
  width: 48px;
  height: 48px;
  
  ${({ active, theme }) => active && `
    background-color: ${theme.colors.primaryDark};
  `}
`;

const ConversationsContainer = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 16px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  
  h2 {
    margin-bottom: 16px;
  }
  
  p {
    margin-bottom: 24px;
    max-width: 500px;
  }
`;

const SidebarIcon = styled.div`
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Home = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const { user } = useSelector((state) => state.auth);
  const { contacts } = useSelector((state) => state.contacts);
  const { groups } = useSelector((state) => state.groups);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Fetch contacts and groups on component mount
    dispatch(fetchContacts());
    dispatch(fetchGroups());
  }, [dispatch]);
  
  const handleNavigation = (route) => {
    navigate(route);
  };
  
  const handleLogout = () => {
    dispatch(logout());
  };
  
  // Filter conversations based on active tab
  const getFilteredConversations = () => {
    switch (activeTab) {
      case 'messages':
        return [...contacts, ...groups];
      case 'contacts':
        return contacts;
      case 'groups':
        return groups;
      default:
        return [];
    }
  };

  return (
    <HomeContainer>
      <Header>
        <Logo>Murmur</Logo>
        <ProfileSection>
          <Username>{user?.username}</Username>
          <Avatar name={user?.username} size="small" />
        </ProfileSection>
      </Header>
      
      <MainContent>
        <Sidebar>
          <SidebarButton 
            variant="contained" 
            active={activeTab === 'messages'} 
            onClick={() => setActiveTab('messages')}
            iconOnly
            title="All Messages"
          >
            <SidebarIcon>
              <RiMessage2Line />
            </SidebarIcon>
          </SidebarButton>
          
          <SidebarButton 
            variant="contained" 
            active={activeTab === 'contacts'} 
            onClick={() => setActiveTab('contacts')}
            iconOnly
            title="Contacts"
          >
            <SidebarIcon>
              <RiUser3Line />
            </SidebarIcon>
          </SidebarButton>
          
          <SidebarButton 
            variant="contained" 
            active={activeTab === 'groups'} 
            onClick={() => setActiveTab('groups')}
            iconOnly
            title="Groups"
          >
            <SidebarIcon>
              <RiTeamLine />
            </SidebarIcon>
          </SidebarButton>
          
          <SidebarButton 
            variant="contained" 
            onClick={() => handleNavigation('/settings')}
            iconOnly
            title="Settings"
          >
            <SidebarIcon>
              <RiSettings4Line />
            </SidebarIcon>
          </SidebarButton>
          
          <SidebarButton 
            variant="contained" 
            color="error" 
            onClick={handleLogout}
            iconOnly
            title="Logout"
            style={{ marginTop: 'auto' }}
          >
            <SidebarIcon>
              <RiLogoutBoxLine />
            </SidebarIcon>
          </SidebarButton>
        </Sidebar>
        
        <ConversationsContainer>
          {getFilteredConversations().length > 0 ? (
            <ConversationList 
              conversations={getFilteredConversations()} 
              type={activeTab === 'groups' ? 'group' : activeTab === 'contacts' ? 'contact' : 'all'} 
            />
          ) : (
            <EmptyState>
              <h2>No {activeTab} yet</h2>
              <p>
                {activeTab === 'messages' 
                  ? 'Start a new conversation by adding contacts or creating a group.' 
                  : activeTab === 'contacts' 
                  ? 'Add contacts to start messaging privately.' 
                  : 'Create a group to chat with multiple people at once.'}
              </p>
              <Button 
                onClick={() => handleNavigation(`/${activeTab}`)}
                startIcon={
                  activeTab === 'contacts' 
                    ? <RiUser3Line /> 
                    : activeTab === 'groups' 
                    ? <RiTeamLine /> 
                    : null
                }
              >
                {activeTab === 'contacts' 
                  ? 'Add Contacts' 
                  : activeTab === 'groups' 
                  ? 'Create Group' 
                  : 'Get Started'}
              </Button>
            </EmptyState>
          )}
        </ConversationsContainer>
      </MainContent>
    </HomeContainer>
  );
};

export default Home;
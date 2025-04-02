import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FiPlus, FiSearch, FiMessageSquare, FiMoreVertical, FiTrash2, FiUsers, FiEdit, FiLogOut } from 'react-icons/fi';

// Components
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// Store & Services
import { fetchGroups, createGroup, leaveGroup, deleteGroup } from '../store/slices/groupsSlice';

const GroupsContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 16px;
`;

const GroupsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const HeaderLeft = styled.div``;

const GroupsTitle = styled.h1`
  ${({ theme }) => theme.typography.h4};
  margin: 0;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const GroupsDescription = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const SearchContainer = styled.div`
  margin-bottom: 24px;
`;

const GroupsList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  
  @media (min-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const GroupCard = styled(Card)`
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const GroupInfo = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
`;

const GroupDetails = styled.div`
  margin-left: 16px;
  flex: 1;
`;

const GroupName = styled.h3`
  ${({ theme }) => theme.typography.subtitle1};
  margin: 0;
  margin-bottom: 4px;
`;

const GroupStatus = styled.p`
  ${({ theme }) => theme.typography.body2};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const GroupActions = styled.div`
  display: flex;
  padding: 8px 16px 16px;
  justify-content: space-between;
`;

const CreateGroupForm = styled.div`
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

const MenuContainer = styled.div`
  position: relative;
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
`;

const Menu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 10;
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: 4px;
  box-shadow: ${({ theme }) => theme.elevation[4]};
  min-width: 150px;
  overflow: hidden;
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  background: none;
  border: none;
  color: ${({ theme, danger }) => danger ? theme.colors.error : theme.colors.textPrimary};
  cursor: pointer;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  svg {
    margin-right: 12px;
  }
`;

const ContactSelection = styled.div`
  margin-top: 16px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 8px;
`;

const ContactOption = styled.div`
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  input {
    margin-right: 12px;
  }
`;

const ContactName = styled.span`
  margin-left: 12px;
  flex: 1;
`;

const Groups = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { groups, loading } = useSelector((state) => state.groups);
  const { contacts } = useSelector((state) => state.contacts);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', members: [] });
  const [createStatus, setCreateStatus] = useState({ loading: false, error: null });
  const [openMenuId, setOpenMenuId] = useState(null);
  
  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);
  
  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || newGroup.members.length === 0) return;
    
    try {
      setCreateStatus({ loading: true, error: null });
      
      await dispatch(createGroup({
        name: newGroup.name,
        description: newGroup.description,
        memberIds: newGroup.members
      })).unwrap();
      
      setCreateStatus({ loading: false, error: null });
      setNewGroup({ name: '', description: '', members: [] });
      setShowCreateForm(false);
      
    } catch (error) {
      setCreateStatus({ 
        loading: false, 
        error: error.message || 'Failed to create group'
      });
    }
  };
  
  const handleOpenChat = (groupId) => {
    navigate(`/chat/${groupId}`);
  };
  
  const handleOpenMenu = (groupId) => {
    setOpenMenuId(openMenuId === groupId ? null : groupId);
  };
  
  const handleLeaveGroup = async (groupId) => {
    if (window.confirm('Are you sure you want to leave this group?')) {
      try {
        await dispatch(leaveGroup(groupId)).unwrap();
        setOpenMenuId(null);
      } catch (error) {
        console.error('Failed to leave group:', error);
      }
    }
  };
  
  const handleDeleteGroup = async (groupId) => {
    if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        await dispatch(deleteGroup(groupId)).unwrap();
        setOpenMenuId(null);
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  };
  
  const toggleMember = (contactId) => {
    setNewGroup(prev => {
      if (prev.members.includes(contactId)) {
        return {
          ...prev,
          members: prev.members.filter(id => id !== contactId)
        };
      } else {
        return {
          ...prev,
          members: [...prev.members, contactId]
        };
      }
    });
  };
  
  return (
    <GroupsContainer>
      <GroupsHeader>
        <HeaderLeft>
          <GroupsTitle>Groups</GroupsTitle>
          <GroupsDescription>Create and manage your group conversations</GroupsDescription>
        </HeaderLeft>
        <Button 
          variant="contained" 
          startIcon={<FiPlus />}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          Create Group
        </Button>
      </GroupsHeader>
      
      {showCreateForm && (
        <CreateGroupForm>
          <Card>
            <CardHeader divider>
              <CardTitle>Create New Group</CardTitle>
            </CardHeader>
            <CardContent>
              <TextField
                label="Group Name"
                placeholder="Enter group name"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                fullWidth
                required
              />
              
              <TextField
                label="Description"
                placeholder="Enter group description (optional)"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                fullWidth
                multiline
              />
              
              <div style={{ marginTop: '16px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Select Group Members</p>
                {contacts.length > 0 ? (
                  <ContactSelection>
                    {contacts.map(contact => (
                      <ContactOption key={contact.id}>
                        <input 
                          type="checkbox"
                          id={`contact-${contact.id}`}
                          checked={newGroup.members.includes(contact.id)}
                          onChange={() => toggleMember(contact.id)}
                        />
                        <Avatar 
                          size="small"
                          src={contact.avatar} 
                          name={contact.displayName || contact.username} 
                        />
                        <ContactName>{contact.displayName || contact.username}</ContactName>
                      </ContactOption>
                    ))}
                  </ContactSelection>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                    You don't have any contacts to add to the group. Add contacts first.
                  </p>
                )}
              </div>
              
              {createStatus.error && (
                <p style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>{createStatus.error}</p>
              )}
            </CardContent>
            <CardFooter divider>
              <Button
                variant="outlined"
                onClick={() => setShowCreateForm(false)}
                style={{ marginRight: '12px' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateGroup}
                disabled={createStatus.loading || !newGroup.name.trim() || newGroup.members.length === 0}
              >
                {createStatus.loading ? 'Creating...' : 'Create Group'}
              </Button>
            </CardFooter>
          </Card>
        </CreateGroupForm>
      )}
      
      <SearchContainer>
        <TextField
          fullWidth
          placeholder="Search groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startAdornment={<FiSearch />}
        />
      </SearchContainer>
      
      {loading ? (
        <EmptyState>
          <p>Loading groups...</p>
        </EmptyState>
      ) : filteredGroups.length > 0 ? (
        <GroupsList>
          {filteredGroups.map(group => (
            <GroupCard key={group.id} elevation={1}>
              <GroupInfo>
                <Avatar 
                  src={group.avatar} 
                  name={group.name} 
                  isGroup
                />
                <GroupDetails>
                  <GroupName>{group.name}</GroupName>
                  <GroupStatus>
                    {group.memberCount || 0} members
                    {group.isAdmin && ' • Admin'}
                  </GroupStatus>
                </GroupDetails>
                <MenuContainer>
                  <MenuButton onClick={() => handleOpenMenu(group.id)}>
                    <FiMoreVertical />
                  </MenuButton>
                  {openMenuId === group.id && (
                    <Menu>
                      {group.isAdmin && (
                        <MenuItem onClick={() => console.log('Edit group')}>
                          <FiEdit /> Edit Group
                        </MenuItem>
                      )}
                      {group.isAdmin ? (
                        <MenuItem 
                          danger 
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <FiTrash2 /> Delete Group
                        </MenuItem>
                      ) : (
                        <MenuItem 
                          danger 
                          onClick={() => handleLeaveGroup(group.id)}
                        >
                          <FiLogOut /> Leave Group
                        </MenuItem>
                      )}
                    </Menu>
                  )}
                </MenuContainer>
              </GroupInfo>
              <CardContent>
                {group.description && (
                  <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.7)' }}>
                    {group.description}
                  </p>
                )}
              </CardContent>
              <GroupActions>
                <Button
                  variant="outlined"
                  startIcon={<FiMessageSquare />}
                  onClick={() => handleOpenChat(group.id)}
                  fullWidth
                >
                  Open Chat
                </Button>
              </GroupActions>
            </GroupCard>
          ))}
        </GroupsList>
      ) : (
        <EmptyState>
          <FiUsers size={48} style={{ opacity: 0.5 }} />
          <EmptyStateText>
            {searchTerm ? 'No groups matching your search' : 'You don\'t have any groups yet'}
          </EmptyStateText>
          <Button
            variant="contained"
            onClick={() => {
              setShowCreateForm(true);
              setSearchTerm('');
            }}
            startIcon={<FiPlus />}
          >
            Create Your First Group
          </Button>
        </EmptyState>
      )}
    </GroupsContainer>
  );
};

export default Groups;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { formatDistanceToNow } from 'date-fns';

// Components
import Avatar from '../ui/Avatar';

const ListContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow-y: auto;
`;

const SearchBar = styled.div`
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  position: sticky;
  top: 0;
  background-color: ${({ theme }) => theme.colors.surface};
  z-index: 1;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 16px;
  border-radius: 24px;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const ConversationItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }
  
  ${({ active, theme }) => active && `
    background-color: rgba(98, 0, 238, 0.08);
    
    &:hover {
      background-color: rgba(98, 0, 238, 0.12);
    }
  `}
`;

const ConversationInfo = styled.div`
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
`;

const ConversationName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LastMessage = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ConversationMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 8px;
`;

const Timestamp = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const UnreadBadge = styled.div`
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  margin-top: 4px;
`;

const ConversationList = ({ conversations, type = 'all' }) => {
  const { activeConversation } = useSelector((state) => state.messages);
  const navigate = useNavigate();
  
  const handleSelectConversation = (conversationId) => {
    navigate(`/chat/${conversationId}`);
  };
  
  // Function to get the last message (would need to be implemented with real data)
  const getLastMessage = (conversation) => {
    return {
      text: 'This is a placeholder message',
      timestamp: new Date(),
      unreadCount: Math.floor(Math.random() * 3), // Random for demonstration
    };
  };
  
  return (
    <ListContainer>
      <SearchBar>
        <SearchInput placeholder="Search..." />
      </SearchBar>
      
      <List>
        {conversations.map((conversation) => {
          const lastMessage = getLastMessage(conversation);
          const isGroup = conversation.members && conversation.members.length > 2;
          const name = isGroup ? conversation.name : conversation.username;
          
          return (
            <ConversationItem
              key={conversation.id}
              active={activeConversation === conversation.id}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <Avatar 
                name={name} 
                src={conversation.avatar} 
                color={isGroup ? '#03dac6' : undefined}
              />
              
              <ConversationInfo>
                <ConversationName>{name}</ConversationName>
                <LastMessage>{lastMessage.text}</LastMessage>
              </ConversationInfo>
              
              <ConversationMeta>
                <Timestamp>
                  {formatDistanceToNow(lastMessage.timestamp, { addSuffix: false })}
                </Timestamp>
                
                {lastMessage.unreadCount > 0 && (
                  <UnreadBadge>{lastMessage.unreadCount}</UnreadBadge>
                )}
              </ConversationMeta>
            </ConversationItem>
          );
        })}
      </List>
    </ListContainer>
  );
};

export default ConversationList;
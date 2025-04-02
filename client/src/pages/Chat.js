import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiArrowLeftSLine, RiInformationLine } from 'react-icons/ri';

// Redux actions
import { fetchConversationMessages, setActiveConversation } from '../store/slices/messagesSlice';

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

const Chat = () => {
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { contacts } = useSelector((state) => state.contacts);
  const { groups } = useSelector((state) => state.groups);
  
  // Determine if this is a group or direct chat
  const isGroup = conversationId.startsWith('group:');
  const actualId = isGroup ? conversationId.replace('group:', '') : conversationId;
  
  // Find the conversation details
  const conversation = isGroup
    ? groups.find((group) => group.id === actualId)
    : contacts.find((contact) => contact.id === actualId || 
        conversationId.includes(contact.id));
  
  useEffect(() => {
    if (conversationId) {
      // Set active conversation
      dispatch(setActiveConversation(conversationId));
      
      // Fetch messages
      dispatch(fetchConversationMessages(conversationId));
    }
    
    return () => {
      // Clear active conversation when unmounting
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch]);
  
  const handleBack = () => {
    navigate('/');
  };
  
  if (!conversation) {
    return (
      <ChatContainer>
        <ChatHeader>
          <BackButton onClick={handleBack}>
            <RiArrowLeftSLine />
          </BackButton>
          <ContactInfo>
            <ContactName>Conversation</ContactName>
          </ContactInfo>
        </ChatHeader>
        
        <ChatContent>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            Loading conversation...
          </div>
        </ChatContent>
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
          <Avatar 
            name={isGroup ? conversation.name : conversation.username} 
            src={conversation.avatar}
            color={isGroup ? '#03dac6' : undefined}
          />
          <ContactDetails>
            <ContactName>
              {isGroup ? conversation.name : conversation.username}
            </ContactName>
            <ContactStatus>
              {isGroup 
                ? `${conversation.members.length} members` 
                : 'Online'} {/* Would be dynamic in a real app */}
            </ContactStatus>
          </ContactDetails>
        </ContactInfo>
        
        <InfoButton>
          <RiInformationLine />
        </InfoButton>
      </ChatHeader>
      
      <ChatContent>
        <MessageList conversationId={conversationId} />
        <MessageInput 
          conversationId={conversationId}
          recipientId={!isGroup ? conversation.id : null}
          groupId={isGroup ? actualId : null}
        />
      </ChatContent>
    </ChatContainer>
  );
};

export default Chat;
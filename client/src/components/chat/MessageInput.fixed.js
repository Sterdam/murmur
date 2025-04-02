import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { RiSendPlaneFill, RiAttachment2, RiEmotionLine } from 'react-icons/ri';

// Redux actions
import { sendMessage } from '../../store/slices/messagesSlice';

const InputContainer = styled.div`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid rgba(255, 255, 255, 0.12);
`;

const InputForm = styled.form`
  display: flex;
  align-items: flex-end;
  gap: 12px;
`;

const TextArea = styled.textarea`
  flex: 1;
  padding: 12px 16px;
  border-radius: 24px;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  resize: none;
  max-height: 120px;
  font-family: inherit;
  font-size: 1rem;
  
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const IconButton = styled.button`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, primary }) => primary ? theme.colors.primary : 'rgba(255, 255, 255, 0.04)'};
  color: ${({ theme, primary }) => primary ? theme.colors.onPrimary : theme.colors.textPrimary};
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${({ theme, primary }) => primary ? theme.colors.primaryDark : 'rgba(255, 255, 255, 0.08)'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  & > svg {
    font-size: 20px;
  }
`;

const MessageInput = ({ conversationId, recipientId, groupId }) => {
  const [message, setMessage] = useState('');
  const dispatch = useDispatch();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (message.trim() === '') return;
    
    // Send message
    dispatch(sendMessage({
      message: message.trim(),
      recipientId,
      groupId,
    }));
    
    // Clear input
    setMessage('');
  };
  
  const handleKeyDown = (e) => {
    // Send message on Enter (without Shift key)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <InputContainer>
      <InputForm onSubmit={handleSubmit}>
        <IconButton type="button" title="Attach file">
          <RiAttachment2 />
        </IconButton>
        
        <TextArea
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        
        <IconButton type="button" title="Add emoji">
          <RiEmotionLine />
        </IconButton>
        
        <IconButton 
          type="submit" 
          primary 
          disabled={message.trim() === ''}
          title="Send message"
        >
          <RiSendPlaneFill />
        </IconButton>
      </InputForm>
    </InputContainer>
  );
};

export default MessageInput;
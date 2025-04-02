// client/src/components/chat/MessageInput.js
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiSendPlaneFill, RiAttachment2, RiEmotionLine } from 'react-icons/ri';
import { FiAlertCircle } from 'react-icons/fi';

// Redux actions
import { sendMessage } from '../../store/slices/messagesSlice';

const InputContainer = styled.div`
  padding: 16px;
  background-color: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid rgba(255, 255, 255, 0.12);
`;

const InputForm = styled.form`
  display: flex;
  flex-direction: column;
`;

const InputRow = styled.div`
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
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

const ErrorMessage = styled.div`
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
    flex-shrink: 0;
  }
`;

const MessageInput = ({ conversationId, recipientId, groupId }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  
  const dispatch = useDispatch();
  const { contacts } = useSelector((state) => state.contacts);
  
  // Fonction pour normaliser les IDs de conversation
  const normalizeConversationId = (id) => {
    if (!id) return id;
    
    // Si c'est un ID de groupe, le laisser tel quel
    if (id.startsWith('group:')) return id;
    
    // Si c'est un ID direct, trier les parties
    if (id.includes(':')) {
      const parts = id.split(':');
      if (parts.length === 2) {
        return parts.sort().join(':');
      }
    }
    
    // Format inconnu, retourner tel quel
    return id;
  };
  
  // Normaliser l'ID de conversation
  const normalizedConversationId = conversationId ? normalizeConversationId(conversationId) : null;
  
  // Find the recipient in contacts to check public key
  const recipient = recipientId ? contacts.find(contact => contact.id === recipientId) : null;
  const hasPublicKey = recipient && recipient.publicKey;
  
  // Clear error when messageInput changes or unmounts
  useEffect(() => {
    return () => setError(null);
  }, [conversationId, recipientId, groupId]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate message
    if (!message.trim() || sending) return;
    
    // Vérifications supplémentaires
    if (!recipientId && !groupId) {
      setError("Impossible d'envoyer le message : destinataire non spécifié.");
      return;
    }
    
    // Check if recipient public key is available for direct messages
    if (recipientId && !hasPublicKey) {
      setError('Cannot send message - the recipient has not shared their public key. You need to be connected contacts to exchange messages securely.');
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      
      // Send message
      await dispatch(sendMessage({
        message: message.trim(),
        recipientId,
        groupId,
        conversationId: normalizedConversationId
      })).unwrap();
      
      // Clear input
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Handle specific errors
      if (typeof error === 'string' && error.includes && error.includes('public key')) {
        setError('Cannot send message securely. Make sure you are connected with this contact before exchanging messages.');
      } else if (error && error.message) {
        setError(error.message);
      } else {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };
  
  const handleKeyDown = (e) => {
    // Send message on Enter (without Shift key)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  // Placeholder text based on state
  const getPlaceholderText = () => {
    if (!conversationId) return "Chargement de la conversation...";
    if (!hasPublicKey && recipientId) return "Vous devez être connecté avec ce contact avant de pouvoir échanger des messages";
    if (sending) return "Envoi en cours...";
    return "Tapez un message...";
  };

  return (
    <InputContainer>
      <InputForm onSubmit={handleSubmit}>
        {error && (
          <ErrorMessage>
            <FiAlertCircle size={16} />
            <span>{error}</span>
          </ErrorMessage>
        )}
        
        <InputRow>
          <IconButton
            type="button"
            title="Attach file"
            disabled={!hasPublicKey && recipientId || sending}
          >
            <RiAttachment2 />
          </IconButton>
          
          <TextArea
            placeholder={getPlaceholderText()}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending || (!hasPublicKey && recipientId) || !conversationId}
          />
          
          <IconButton
            type="button"
            title="Add emoji"
            disabled={!hasPublicKey && recipientId || sending}
          >
            <RiEmotionLine />
          </IconButton>
          
          <IconButton 
            type="submit" 
            primary 
            disabled={message.trim() === '' || sending || (!hasPublicKey && recipientId) || !conversationId}
            title="Send message"
          >
            <RiSendPlaneFill />
          </IconButton>
        </InputRow>
      </InputForm>
    </InputContainer>
  );
};

export default MessageInput;
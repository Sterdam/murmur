import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiSendPlaneFill, RiAttachment2, RiEmotionLine, RiLockLine } from 'react-icons/ri';
import { FiAlertCircle, FiInfo } from 'react-icons/fi';

// Redux actions
import { sendMessage, clearMessageError, normalizeConversationId } from '../../store/slices/messagesSlice';
import socketService from '../../services/socket';

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
  border: 1px solid rgba(255, 255, 255, ${({ error }) => (error ? '0.24' : '0.12')});
  color: ${({ theme }) => theme.colors.textPrimary};
  outline: none;
  resize: none;
  max-height: 120px;
  min-height: 42px;
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.2s;
  
  &:focus {
    border-color: ${({ theme, error }) => error ? theme.colors.error : theme.colors.primary};
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
  transition: background-color 0.2s, transform 0.1s;
  
  &:hover {
    background-color: ${({ theme, primary }) => primary ? theme.colors.primaryDark : 'rgba(255, 255, 255, 0.08)'};
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  & > svg {
    font-size: 20px;
  }
`;

const ErrorMessage = styled.div`
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  padding: 10px 16px;
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

const InfoBanner = styled.div`
  background-color: rgba(33, 150, 243, 0.1);
  color: ${({ theme }) => theme.colors.textPrimary};
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 8px;
    color: #2196F3;
    flex-shrink: 0;
  }
`;

const EncryptionIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  
  svg {
    margin-right: 4px;
    font-size: 14px;
    color: #4CAF50;
  }
`;

const MessageInput = ({ conversationId, recipientId, groupId }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contentRows, setContentRows] = useState(1);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [lastTypingSignal, setLastTypingSignal] = useState(0);
  const [fileUploadStatus, setFileUploadStatus] = useState(null);
  
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();
  const { contacts } = useSelector((state) => state.contacts);
  const { groups } = useSelector((state) => state.groups);
  const { user } = useSelector((state) => state.auth);
  const { error: messageError } = useSelector((state) => state.messages);
  
  // Normalize conversation ID consistently
  const normalizedConversationId = useMemo(() => {
    return conversationId ? normalizeConversationId(conversationId) : null;
  }, [conversationId]);
  
  // Find recipient and check their public key
  const recipient = useCallback(() => {
    if (!recipientId || !Array.isArray(contacts)) return null;
    const found = contacts.find(contact => contact?.id === recipientId);
    return found || null;
  }, [recipientId, contacts]);
  
  // Find group if it's a group message
  const group = useCallback(() => {
    if (!groupId || !Array.isArray(groups)) return null;
    const found = groups.find(g => g?.id === groupId);
    return found || null;
  }, [groupId, groups]);
  
  const recipientObj = recipient();
  const groupObj = group();
  const hasPublicKey = recipientObj && recipientObj.publicKey;
  
  // Check if we have members with keys in the group
  const groupHasMembers = useMemo(() => {
    if (!groupObj || !groupObj.members || !Array.isArray(groupObj.members)) return false;
    
    // Check that there's at least one member (other than current user) with a public key
    const membersWithKeys = groupObj.members.filter(memberId => {
      if (memberId === user?.id) return false; // Ignore current user
      const member = contacts.find(contact => contact.id === memberId);
      return member && member.publicKey;
    });
    
    return membersWithKeys.length > 0;
  }, [groupObj, contacts, user]);
  
  // Handle Redux errors
  useEffect(() => {
    if (messageError) {
      setError(messageError);
    }
    
    return () => {
      if (messageError) {
        dispatch(clearMessageError());
      }
    };
  }, [messageError, dispatch]);
  
  // Reset errors on conversation change
  useEffect(() => {
    setError(null);
    setMessage('');
    setContentRows(1);
    setFileUploadStatus(null);
    
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [conversationId, recipientId, groupId, normalizedConversationId]);
  
  // Function to calculate number of lines in message
  const calculateRows = useCallback((text) => {
    if (!text) return 1;
    const lineCount = (text.match(/\n/g) || []).length + 1;
    return Math.min(Math.max(lineCount, 1), 5); // Max 5 lines
  }, []);
  
  // Handle textarea input
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Adjust number of rows
    setContentRows(calculateRows(newMessage));
    
    // Clear errors on input
    if (error) {
      setError(null);
    }
    
    // Send typing indicator
    const now = Date.now();
    if (normalizedConversationId && now - lastTypingSignal > 3000) { // Limit to one signal every 3 seconds
      if (socketService.isConnected()) {
        socketService.sendTypingIndicator({
          conversationId: normalizedConversationId,
          senderId: user?.id,
          senderUsername: user?.username
        });
        setLastTypingSignal(now);
      }
      
      // Clean up previous timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    }
  };
  
  // Submit message
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clean up message
    const trimmedMessage = message.trim();
    
    // Validation
    if (!trimmedMessage || sending) return;
    
    // Additional checks
    if (!recipientId && !groupId) {
      setError("Impossible d'envoyer le message : destinataire non spécifié.");
      return;
    }
    
    // Check public key for direct messages
    if (recipientId && !hasPublicKey) {
      setError("Impossible d'envoyer le message : le destinataire n'a pas partagé sa clé publique. Vous devez être contacts connectés pour échanger des messages en toute sécurité.");
      return;
    }
    
    // Check if in a group
    if (groupId && !groupHasMembers) {
      setError("Impossible d'envoyer le message : aucun membre du groupe n'a de clé publique disponible.");
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      
      // Prepare message data
      const messageData = {
        message: trimmedMessage,
        conversationId: normalizedConversationId
      };
      
      // Add appropriate IDs
      if (recipientId) {
        messageData.recipientId = recipientId;
      } else if (groupId) {
        messageData.groupId = groupId;
      }
      
      // Check socket connection before sending
      const isSocketConnected = socketService.isConnected();
      
      // Try to reconnect socket if not connected
      if (!isSocketConnected) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            await socketService.connect(token);
          } catch (err) {
            console.warn("Socket reconnection failed:", err);
          }
        }
      }
      
      // Dispatch send action
      await dispatch(sendMessage(messageData)).unwrap();
      
      // Reset form after success
      setMessage('');
      setContentRows(1);
      setFileUploadStatus(null);
      
      // Focus on textarea
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Handle specific errors
      if (typeof error === 'string') {
        if (error.includes('public key')) {
          setError("Impossible d'envoyer le message en toute sécurité. Assurez-vous d'être connecté avec ce contact avant d'échanger des messages.");
        } else if (error.includes('network') || error.includes('connexion')) {
          setError("Problème de connexion. Le message sera envoyé dès que vous serez à nouveau en ligne.");
        } else {
          setError(error);
        }
      } else if (error && error.message) {
        setError(error.message);
      } else {
        setError("Échec de l'envoi du message. Veuillez réessayer.");
      }
    } finally {
      setSending(false);
    }
  };
  
  // Handle special keys (notably Enter to send)
  const handleKeyDown = (e) => {
    // Send message on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    // Expand textarea on Shift+Enter
    if (e.key === 'Enter' && e.shiftKey) {
      const newValue = message + '\n';
      setContentRows(calculateRows(newValue));
    }
  };
  
  // Open file selector
  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file change
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Limit file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Le fichier est trop volumineux. La taille maximale est de 10 Mo.");
      return;
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      setError("Type de fichier non pris en charge. Les types acceptés sont: JPEG, PNG, GIF, PDF, TXT.");
      return;
    }
    
    setFileUploadStatus({
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Adjust message to include a mention of the file
    setMessage((prev) => 
      prev ? `${prev}\n[Fichier: ${file.name}]` : `[Fichier: ${file.name}]`
    );
    setContentRows(calculateRows(message + `\n[Fichier: ${file.name}]`));
  };
  
  // Placeholder text based on state
  const getPlaceholderText = () => {
    if (!conversationId) return "Chargement de la conversation...";
    if (recipientId && !hasPublicKey) return "Vous devez être connecté avec ce contact pour envoyer des messages";
    if (groupId && !groupHasMembers) return "Aucun membre du groupe n'a de clé publique";
    if (sending) return "Envoi en cours...";
    return "Tapez un message...";
  };
  
  // Check if message can be sent
  const canSendMessage = () => {
    if (sending) return false;
    if (!conversationId) return false;
    if (recipientId && !hasPublicKey) return false;
    if (groupId && !groupHasMembers) return false;
    return message.trim() !== '';
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
        
        {/* Show information banner for group messages */}
        {groupId && groupObj && (
          <InfoBanner>
            <FiInfo size={16} />
            <span>
              Les messages envoyés dans ce groupe seront chiffrés pour 
              {groupHasMembers ? ` ${groupObj.members.filter(id => id !== user?.id).length} membre(s)` : ' tous les membres'} 
              à l'aide de leurs clés publiques.
            </span>
          </InfoBanner>
        )}
        
        {/* Show file upload status */}
        {fileUploadStatus && (
          <InfoBanner>
            <RiAttachment2 size={16} />
            <span>
              Fichier: {fileUploadStatus.name} ({Math.round(fileUploadStatus.size / 1024)} Ko)
            </span>
          </InfoBanner>
        )}
        
        <InputRow>
          <IconButton
            type="button"
            title="Joindre un fichier"
            disabled={!canSendMessage()}
            onClick={handleAttachmentClick}
          >
            <RiAttachment2 />
          </IconButton>
          
          {/* Hidden file input */}
          <input 
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          
          <TextArea
            ref={textAreaRef}
            placeholder={getPlaceholderText()}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            rows={contentRows}
            error={!!error}
            disabled={sending || (recipientId && !hasPublicKey) || (groupId && !groupHasMembers) || !conversationId}
          />
          
          <IconButton
            type="button"
            title="Ajouter un emoji"
            disabled={!canSendMessage()}
          >
            <RiEmotionLine />
          </IconButton>
          
          <IconButton 
            type="submit" 
            primary 
            disabled={!canSendMessage()}
            title="Envoyer le message"
          >
            <RiSendPlaneFill />
          </IconButton>
        </InputRow>
        
        <EncryptionIndicator>
          <RiLockLine />
          <span>Message protégé par chiffrement de bout en bout</span>
        </EncryptionIndicator>
      </InputForm>
    </InputContainer>
  );
};

export default MessageInput;
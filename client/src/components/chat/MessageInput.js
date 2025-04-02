import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { RiSendPlaneFill, RiAttachment2, RiEmotionLine } from 'react-icons/ri';
import { FiAlertCircle } from 'react-icons/fi';

// Redux actions
import { sendMessage, clearMessageError } from '../../store/slices/messagesSlice';
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

const MessageInput = ({ conversationId, recipientId, groupId }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [contentRows, setContentRows] = useState(1);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [lastTypingSignal, setLastTypingSignal] = useState(0);
  
  const textAreaRef = useRef(null);
  const dispatch = useDispatch();
  const { contacts } = useSelector((state) => state.contacts);
  const { user } = useSelector((state) => state.auth);
  const { error: messageError } = useSelector((state) => state.messages);
  
  // Normaliser l'ID de conversation de façon cohérente
  const normalizeConversationId = useCallback((id) => {
    if (!id) return null;
    
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
  }, []);
  
  // Normaliser l'ID de conversation
  const normalizedConversationId = conversationId ? normalizeConversationId(conversationId) : null;
  
  // Trouver le destinataire et vérifier sa clé publique
  const recipient = useCallback(() => {
    if (!recipientId || !Array.isArray(contacts)) return null;
    const found = contacts.find(contact => contact?.id === recipientId);
    return found || null;
  }, [recipientId, contacts]);
  
  const recipientObj = recipient();
  const hasPublicKey = recipientObj && recipientObj.publicKey;
  
  // Effect pour gérer les erreurs Redux
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
  
  // Effect pour réinitialiser les erreurs lors du changement de conversation
  useEffect(() => {
    setError(null);
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [conversationId, recipientId, groupId, typingTimeout]);
  
  // Fonction pour calculer le nombre de lignes du message
  const calculateRows = useCallback((text) => {
    if (!text) return 1;
    const lineCount = (text.match(/\n/g) || []).length + 1;
    return Math.min(Math.max(lineCount, 1), 5); // Max 5 lines
  }, []);
  
  // Gérer la saisie dans le textarea
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Ajuster le nombre de lignes
    setContentRows(calculateRows(newMessage));
    
    // Effacer les erreurs lors de la saisie
    if (error) {
      setError(null);
    }
    
    // Envoyer un signal de frappe
    const now = Date.now();
    if (normalizedConversationId && now - lastTypingSignal > 3000) { // Limiter à un signal toutes les 3 secondes
      if (socketService.isConnected()) {
        socketService.sendTypingIndicator({
          conversationId: normalizedConversationId,
          senderId: user?.id,
          senderUsername: user?.username
        });
        setLastTypingSignal(now);
      }
      
      // Nettoyer le timeout précédent
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    }
  };
  
  // Soumettre le message
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Nettoyer le message
    const trimmedMessage = message.trim();
    
    // Validation
    if (!trimmedMessage || sending) return;
    
    // Vérifications additionnelles
    if (!recipientId && !groupId) {
      setError("Impossible d'envoyer le message : destinataire non spécifié.");
      return;
    }
    
    // Vérifier la clé publique pour les messages directs
    if (recipientId && !hasPublicKey) {
      setError("Impossible d'envoyer le message : le destinataire n'a pas partagé sa clé publique. Vous devez être contacts connectés pour échanger des messages en toute sécurité.");
      return;
    }
    
    // Vérifier si dans un groupe
    if (groupId && !normalizedConversationId?.startsWith('group:')) {
      setError("Erreur de configuration de conversation : l'ID de groupe est invalide.");
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      
      // Préparer les données du message
      const messageData = {
        message: trimmedMessage,
        conversationId: normalizedConversationId
      };
      
      // Ajouter les identifiants appropriés
      if (recipientId) {
        messageData.recipientId = recipientId;
      } else if (groupId) {
        messageData.groupId = groupId;
      }
      
      // Dispatch de l'action d'envoi
      await dispatch(sendMessage(messageData)).unwrap();
      
      // Réinitialiser le formulaire après succès
      setMessage('');
      setContentRows(1);
      
      // Focus sur le textarea
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Gérer les erreurs spécifiques
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
  
  // Gérer les touches spéciales (notamment Entrée pour envoyer)
  const handleKeyDown = (e) => {
    // Envoyer le message sur Entrée (sans Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    // Agrandir le textarea sur Shift+Entrée
    if (e.key === 'Enter' && e.shiftKey) {
      const newValue = message + '\n';
      setContentRows(calculateRows(newValue));
    }
  };
  
  // Texte de placeholder en fonction de l'état
  const getPlaceholderText = () => {
    if (!conversationId) return "Chargement de la conversation...";
    if (!hasPublicKey && recipientId) return "Vous devez être connecté avec ce contact pour envoyer des messages";
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
            title="Joindre un fichier"
            disabled={!hasPublicKey && recipientId || sending}
          >
            <RiAttachment2 />
          </IconButton>
          
          <TextArea
            ref={textAreaRef}
            placeholder={getPlaceholderText()}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            rows={contentRows}
            error={!!error}
            disabled={sending || (!hasPublicKey && recipientId) || !conversationId}
          />
          
          <IconButton
            type="button"
            title="Ajouter un emoji"
            disabled={!hasPublicKey && recipientId || sending}
          >
            <RiEmotionLine />
          </IconButton>
          
          <IconButton 
            type="submit" 
            primary 
            disabled={message.trim() === '' || sending || (!hasPublicKey && recipientId) || !conversationId}
            title="Envoyer le message"
          >
            <RiSendPlaneFill />
          </IconButton>
        </InputRow>
      </InputForm>
    </InputContainer>
  );
};

export default MessageInput;
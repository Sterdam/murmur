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
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();
  const { contacts } = useSelector((state) => state.contacts);
  const { groups } = useSelector((state) => state.groups);
  const { user } = useSelector((state) => state.auth);
  const { error: messageError } = useSelector((state) => state.messages);
  
  // Normaliser l'ID de conversation de façon cohérente
  const normalizedConversationId = useMemo(() => {
    return conversationId ? normalizeConversationId(conversationId) : null;
  }, [conversationId]);
  
  // Log pour débogage
  useEffect(() => {
    console.log(`MessageInput: conversation ${conversationId} → normalisée: ${normalizedConversationId}`);
    console.log(`MessageInput: recipientId=${recipientId}, groupId=${groupId}`);
  }, [conversationId, normalizedConversationId, recipientId, groupId]);
  
  // Trouver le destinataire et vérifier sa clé publique
  const recipient = useCallback(() => {
    if (!recipientId || !Array.isArray(contacts)) return null;
    const found = contacts.find(contact => contact?.id === recipientId);
    return found || null;
  }, [recipientId, contacts]);
  
  // Trouver le groupe si c'est un message de groupe
  const group = useCallback(() => {
    if (!groupId || !Array.isArray(groups)) return null;
    const found = groups.find(g => g?.id === groupId);
    return found || null;
  }, [groupId, groups]);
  
  const recipientObj = recipient();
  const groupObj = group();
  const hasPublicKey = recipientObj && recipientObj.publicKey;
  
  // Vérifier si on a des membres avec des clés dans le groupe
  const groupHasMembers = useMemo(() => {
    if (!groupObj || !groupObj.members || !Array.isArray(groupObj.members)) return false;
    
    // Vérifier qu'il y a au moins un membre (autre que l'utilisateur courant) avec une clé publique
    const membersWithKeys = groupObj.members.filter(memberId => {
      if (memberId === user?.id) return false; // Ignorer l'utilisateur courant
      const member = contacts.find(contact => contact.id === memberId);
      return member && member.publicKey;
    });
    
    return membersWithKeys.length > 0;
  }, [groupObj, contacts, user]);
  
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
    setMessage('');
    setContentRows(1);
    setUploadedFile(null);
    
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [conversationId, recipientId, groupId]);
  
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
  // Dans MessageInput.js, modifiez la fonction d'envoi de message:

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
  if (groupId && !groupHasMembers) {
    setError("Impossible d'envoyer le message : aucun membre du groupe n'a de clé publique disponible.");
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
    
    console.log(`Envoi de message à ${normalizedConversationId}`);
    
    // Vérifier explicitement la connexion socket avant l'envoi
    const isSocketConnected = socketService.isConnected();
    console.log(`État de la connexion socket: ${isSocketConnected ? 'connecté' : 'déconnecté'}`);
    
    // Si le socket n'est pas connecté, tenter une reconnexion
    if (!isSocketConnected) {
      console.log("Socket non connecté, tentative de reconnexion...");
      // Essayer de reconnecter le socket en arrière-plan
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token).catch(err => {
          console.warn("Échec de la reconnexion du socket:", err);
        });
      }
    }
    
    // Dispatch de l'action d'envoi, même en cas de déconnexion
    // La bibliothèque gère maintenant la mise en file d'attente des messages
    await dispatch(sendMessage(messageData)).unwrap();
    
    // Réinitialiser le formulaire après succès
    setMessage('');
    setContentRows(1);
    setUploadedFile(null);
    
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
  
  // Ouvrir le sélecteur de fichier
  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Gérer le changement de fichier
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
      // Ajuster le message pour inclure une mention du fichier
      setMessage((prev) => 
        prev ? `${prev}\n[Fichier: ${files[0].name}]` : `[Fichier: ${files[0].name}]`
      );
      setContentRows(calculateRows(message + `\n[Fichier: ${files[0].name}]`));
    }
  };
  
  // Texte de placeholder en fonction de l'état
  const getPlaceholderText = () => {
    if (!conversationId) return "Chargement de la conversation...";
    if (recipientId && !hasPublicKey) return "Vous devez être connecté avec ce contact pour envoyer des messages";
    if (groupId && !groupHasMembers) return "Aucun membre du groupe n'a de clé publique";
    if (sending) return "Envoi en cours...";
    return "Tapez un message...";
  };
  
  // Vérifier si le message peut être envoyé
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
        
        {/* Afficher une bannière d'information pour les messages de groupe */}
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
        
        <InputRow>
          <IconButton
            type="button"
            title="Joindre un fichier"
            disabled={!canSendMessage()}
            onClick={handleAttachmentClick}
          >
            <RiAttachment2 />
          </IconButton>
          
          {/* Input de fichier caché */}
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
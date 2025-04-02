// client/src/services/encryption.js
/**
 * Service de chiffrement pour la messagerie sécurisée
 * Implémente le chiffrement de bout en bout (E2EE) avec des primitives modernes:
 * - RSA-OAEP pour l'échange de clés
 * - AES-GCM pour le chiffrement symétrique des messages
 */

/**
 * Génère une paire de clés RSA pour le chiffrement asymétrique
 * @returns {Promise<Object>} - Objet contenant les clés publique et privée au format JSON
 */
export const generateKeyPair = async () => {
  try {
    // Vérification de la disponibilité de l'API Web Crypto
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("L'API Web Crypto n'est pas disponible sur ce navigateur");
    }
    
    console.log("Début de la génération de clés");
    
    // Génération d'une paire de clés RSA-OAEP
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,  // 2048 bits pour un bon équilibre sécurité/performance
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        hash: { name: 'SHA-256' }
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    
    console.log("Paire de clés générée, export en cours");
    
    // Exporter la clé publique au format SPKI
    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      'spki',
      keyPair.publicKey
    );
    
    // Exporter la clé privée au format PKCS8
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey
    );
    
    // Convertir en format Base64 pour stockage
    const publicKey = arrayBufferToBase64(publicKeyBuffer);
    const privateKey = arrayBufferToBase64(privateKeyBuffer);
    
    console.log("Clés exportées avec succès");
    
    // Créer un bundle de clés avec des métadonnées
    const keyBundle = {
      publicKey,
      privateKey,
      algorithm: 'RSA-OAEP-2048',
      created: Date.now(),
      keyId: generateRandomId() // Identifiant unique pour cette paire de clés
    };
    
    return {
      publicKey: JSON.stringify({ 
        key: keyBundle.publicKey,
        algorithm: keyBundle.algorithm,
        keyId: keyBundle.keyId
      }),
      privateKey: JSON.stringify(keyBundle)
    };
  } catch (error) {
    console.error('Erreur lors de la génération des clés:', error);
    throw new Error('Échec de la génération des clés de chiffrement: ' + error.message);
  }
};

/**
 * Chiffre un message avec le chiffrement hybride RSA+AES
 * @param {string} message - Message à chiffrer
 * @param {string} recipientPublicKeyJson - Clé publique du destinataire (JSON)
 * @returns {Promise<Object>} - Données chiffrées et métadonnées
 */
export const encryptMessage = async (message, recipientPublicKeyJson) => {
  try {
    if (!message || !recipientPublicKeyJson) {
      throw new Error('Message ou clé publique manquant');
    }
    
    const crypto = window.crypto;
    const subtle = crypto.subtle;
    
    // 1. Parser la clé publique du destinataire
    let recipientPublicBundle;
    try {
      recipientPublicBundle = JSON.parse(recipientPublicKeyJson);
    } catch (error) {
      console.error('Erreur de parsing de la clé publique:', error);
      throw new Error('Format de clé publique invalide');
    }
    
    // 2. Extraction de la clé depuis le format utilisé par l'API
    let publicKeyBase64;
    if (recipientPublicBundle.key) {
      publicKeyBase64 = recipientPublicBundle.key;
    } else if (typeof recipientPublicBundle === 'string') {
      publicKeyBase64 = recipientPublicBundle;
    } else {
      throw new Error('Format de clé publique non reconnu');
    }
    
    // 3. Import de la clé publique au format SPKI
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    
    try {
      const recipientPublicKey = await subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: { name: 'SHA-256' }
        },
        false,
        ['encrypt']
      );
      
      // 4. Génération d'une clé AES-GCM unique pour ce message
      const aesKey = await subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      // 5. Génération d'un vecteur d'initialisation (IV) aléatoire
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // 6. Ajout de données d'authentification supplémentaires
      const messageId = generateRandomId();
      const timestamp = Date.now();
      const authenticatedData = new TextEncoder().encode(`murmur-auth:${messageId}:${timestamp}`);
      
      // 7. Chiffrement du message avec AES-GCM
      const messageBytes = new TextEncoder().encode(message);
      const encryptedMessageBuffer = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: authenticatedData,
          tagLength: 128 // 128 bits pour le tag d'authentification
        },
        aesKey,
        messageBytes
      );
      
      // 8. Export de la clé AES-GCM
      const rawAesKey = await subtle.exportKey('raw', aesKey);
      
      // 9. Chiffrement de la clé AES avec RSA-OAEP
      const encryptedKeyBuffer = await subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey,
        rawAesKey
      );
      
      // 10. Construction des métadonnées de chiffrement
      const metadata = {
        schema: 'murmur-e2ee-v1',
        messageId,
        timestamp,
        algorithm: 'RSA-OAEP-2048+AES-GCM-256',
        iv: arrayBufferToBase64(iv),
        authTagLength: 128,
        version: '1.0'
      };
      
      // 11. Retour des données chiffrées
      return {
        encryptedMessage: arrayBufferToBase64(encryptedMessageBuffer),
        encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
        metadata: JSON.stringify(metadata)
      };
    } catch (error) {
      console.error('Erreur lors du chiffrement:', error);
      throw new Error('Échec du chiffrement du message: ' + error.message);
    }
  } catch (error) {
    console.error('Erreur lors du chiffrement du message:', error);
    throw new Error('Échec du chiffrement du message: ' + error.message);
  }
};

/**
 * Déchiffre un message chiffré
 * @param {string} encryptedMessageBase64 - Message chiffré en Base64
 * @param {string} encryptedKeyBase64 - Clé chiffrée en Base64
 * @param {string} privateKeyJson - Clé privée du destinataire (JSON)
 * @param {string} senderPublicKeyJson - Clé publique de l'expéditeur (optionnel)
 * @param {string} signature - Signature numérique (optionnel)
 * @param {string} metadataJson - Métadonnées de chiffrement (JSON)
 * @returns {Promise<string>} - Message déchiffré
 */
export const decryptMessage = async (
  encryptedMessageBase64,
  encryptedKeyBase64,
  privateKeyJson,
  senderPublicKeyJson = null,
  signature = null,
  metadataJson = '{}'
) => {
  try {
    // Vérifier les entrées
    if (!encryptedMessageBase64 || !encryptedKeyBase64 || !privateKeyJson) {
      throw new Error('Paramètres de déchiffrement manquants');
    }
    
    const crypto = window.crypto;
    const subtle = crypto.subtle;
    
    // 1. Parser les données
    let privateKeyBundle;
    try {
      privateKeyBundle = JSON.parse(privateKeyJson);
    } catch (error) {
      console.error('Erreur de parsing de la clé privée:', error);
      throw new Error('Format de clé privée invalide');
    }
    
    let metadata;
    try {
      metadata = JSON.parse(metadataJson || '{}');
    } catch (error) {
      console.error('Erreur de parsing des métadonnées:', error);
      metadata = {}; // Utiliser un objet vide par défaut
    }
    
    // 2. Extraction de la clé privée
    let privateKeyData;
    if (privateKeyBundle.privateKey) {
      privateKeyData = privateKeyBundle.privateKey;
    } else if (typeof privateKeyBundle === 'object' && privateKeyBundle.key) {
      privateKeyData = privateKeyBundle.key;
    } else {
      privateKeyData = privateKeyBundle; // Essai direct
    }
    
    // 3. Import de la clé privée RSA
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyData);
    
    try {
      const privateKey = await subtle.importKey(
        'pkcs8',
        privateKeyBuffer,
        {
          name: 'RSA-OAEP',
          hash: { name: 'SHA-256' }
        },
        false,
        ['decrypt']
      );
      
      // 4. Déchiffrement de la clé AES-GCM
      const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
      const aesKeyBuffer = await subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedKeyBuffer
      );
      
      // 5. Import de la clé AES-GCM déchiffrée
      const aesKey = await subtle.importKey(
        'raw',
        aesKeyBuffer,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['decrypt']
      );
      
      // 6. Préparer les données pour le déchiffrement
      const iv = metadata.iv ? base64ToArrayBuffer(metadata.iv) : new Uint8Array(12);
      const authTagLength = metadata.authTagLength || 128;
      
      // Créer des données authentifiées supplémentaires si présentes dans les métadonnées
      let authenticatedData = new Uint8Array(0);
      if (metadata.messageId && metadata.timestamp) {
        authenticatedData = new TextEncoder().encode(`murmur-auth:${metadata.messageId}:${metadata.timestamp}`);
      }
      
      // 7. Déchiffrement du message
      const encryptedMessageBuffer = base64ToArrayBuffer(encryptedMessageBase64);
      const decryptedBuffer = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: authenticatedData,
          tagLength: authTagLength
        },
        aesKey,
        encryptedMessageBuffer
      );
      
      // 8. Conversion du buffer en texte
      const decryptedMessage = new TextDecoder().decode(decryptedBuffer);
      
      return decryptedMessage;
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      throw new Error('Échec du déchiffrement: ' + error.message);
    }
  } catch (error) {
    console.error('Erreur lors du déchiffrement du message:', error);
    throw new Error('Échec du déchiffrement: ' + error.message);
  }
};

// Fonctions utilitaires

/**
 * Génère un identifiant unique aléatoire
 * @returns {string} - Identifiant unique
 */
function generateRandomId() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Convertit un ArrayBuffer en chaîne Base64
 * @param {ArrayBuffer} buffer - ArrayBuffer à convertir
 * @returns {string} - Chaîne Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convertit une chaîne Base64 en ArrayBuffer
 * @param {string} base64 - Chaîne Base64
 * @returns {ArrayBuffer} - ArrayBuffer correspondant
 */
function base64ToArrayBuffer(base64) {
  try {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error('Erreur de conversion Base64:', error);
    throw new Error('Erreur de conversion Base64: ' + error.message);
  }
}

/**
 * Chiffre un message pour plusieurs destinataires (messages de groupe)
 * @param {string} message - Message à chiffrer
 * @param {Array} recipientsPublicKeys - Liste des clés publiques des destinataires
 * @returns {Promise<Object>} - Données chiffrées et métadonnées pour tous les destinataires
 */
export const encryptGroupMessage = async (message, recipientsPublicKeys) => {
  try {
    if (!message || !Array.isArray(recipientsPublicKeys) || recipientsPublicKeys.length === 0) {
      throw new Error('Message ou liste de destinataires invalide');
    }
    
    const crypto = window.crypto;
    const subtle = crypto.subtle;
    
    // 1. Génération d'une clé AES-GCM unique pour ce message (partagée entre tous les destinataires)
    const aesKey = await subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    // 2. Génération d'un vecteur d'initialisation (IV) aléatoire
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 3. Ajout de données d'authentification supplémentaires
    const messageId = generateRandomId();
    const timestamp = Date.now();
    const authenticatedData = new TextEncoder().encode(`murmur-group-auth:${messageId}:${timestamp}`);
    
    // 4. Chiffrement du message avec AES-GCM (une seule fois pour tous les destinataires)
    const messageBytes = new TextEncoder().encode(message);
    const encryptedMessageBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: authenticatedData,
        tagLength: 128
      },
      aesKey,
      messageBytes
    );
    
    // 5. Export de la clé AES-GCM
    const rawAesKey = await subtle.exportKey('raw', aesKey);
    
    // 6. Chiffrement de la clé AES avec la clé publique de chaque destinataire
    const encryptedKeys = {};
    let keysEncrypted = 0;
    
    for (const publicKeyJson of recipientsPublicKeys) {
      try {
        if (!publicKeyJson) continue;
        
        // Extraction de la clé publique
        let recipientPublicBundle;
        try {
          recipientPublicBundle = JSON.parse(publicKeyJson);
        } catch (error) {
          console.warn('Format de clé publique invalide pour un destinataire, ignoré');
          continue;
        }
        
        // Extraction de la clé
        let publicKeyBase64;
        let recipientId;
        
        if (recipientPublicBundle.key) {
          publicKeyBase64 = recipientPublicBundle.key;
          recipientId = recipientPublicBundle.id || `recipient-${keysEncrypted}`;
        } else if (typeof recipientPublicBundle === 'string') {
          publicKeyBase64 = recipientPublicBundle;
          recipientId = `recipient-${keysEncrypted}`;
        } else if (recipientPublicBundle.publicKey) {
          publicKeyBase64 = recipientPublicBundle.publicKey;
          recipientId = recipientPublicBundle.id || `recipient-${keysEncrypted}`;
        } else {
          console.warn('Format de clé publique non reconnu pour un destinataire, ignoré');
          continue;
        }
        
        // Import de la clé publique
        const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
        const recipientPublicKey = await subtle.importKey(
          'spki',
          publicKeyBuffer,
          {
            name: 'RSA-OAEP',
            hash: { name: 'SHA-256' }
          },
          false,
          ['encrypt']
        );
        
        // Chiffrement de la clé AES avec RSA-OAEP
        const encryptedKeyBuffer = await subtle.encrypt(
          { name: 'RSA-OAEP' },
          recipientPublicKey,
          rawAesKey
        );
        
        // Stockage de la clé chiffrée pour ce destinataire
        encryptedKeys[recipientId] = arrayBufferToBase64(encryptedKeyBuffer);
        keysEncrypted++;
      } catch (error) {
        console.warn('Échec du chiffrement pour un destinataire:', error);
      }
    }
    
    if (keysEncrypted === 0) {
      throw new Error('Aucune clé n\'a pu être chiffrée pour les destinataires');
    }
    
    // 7. Construction des métadonnées de chiffrement
    const metadata = {
      schema: 'murmur-group-e2ee-v1',
      messageId,
      timestamp,
      algorithm: 'RSA-OAEP-2048+AES-GCM-256',
      iv: arrayBufferToBase64(iv),
      authTagLength: 128,
      recipientCount: keysEncrypted,
      version: '1.0'
    };
    
    // 8. Retour des données chiffrées et des clés pour tous les destinataires
    return {
      encryptedMessage: arrayBufferToBase64(encryptedMessageBuffer),
      encryptedKeys,
      metadata: JSON.stringify(metadata)
    };
  } catch (error) {
    console.error('Erreur lors du chiffrement du message de groupe:', error);
    throw new Error('Échec du chiffrement du message de groupe: ' + error.message);
  }
};
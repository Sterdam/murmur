// client/src/utils/storage.js

/**
 * Fonctions utilitaires pour gérer le stockage local sécurisé
 */

/**
 * Stocke les identifiants utilisateur dans le localStorage
 * @param {Object} credentials - Identifiants utilisateur
 */
export const storeCredentials = (credentials) => {
  try {
    if (credentials.token) {
      localStorage.setItem('token', credentials.token);
    }
    
    if (credentials.user) {
      localStorage.setItem('user', JSON.stringify(credentials.user));
    }
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

/**
 * Récupère les identifiants stockés depuis le localStorage
 * @returns {Object|null} - Identifiants utilisateur ou null
 */
export const getCredentials = () => {
  try {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    
    if (!token || !userJson) {
      return null;
    }
    
    const user = JSON.parse(userJson);
    return { token, user };
  } catch (error) {
    console.error('Error parsing stored user:', error);
    // En cas d'erreur, effacer les données potentiellement corrompues
    clearCredentials();
    return null;
  }
};

/**
 * Efface les identifiants stockés du localStorage
 */
export const clearCredentials = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error clearing credentials:', error);
  }
};

/**
 * Stocke les clés de chiffrement dans le localStorage
 * Cette méthode est simplifiée pour la démonstration
 * Dans une application réelle, les clés privées devraient être stockées
 * de manière plus sécurisée (par exemple, chiffrées avec un mot de passe)
 * 
 * @param {Object} keys - Objet contenant publicKey et privateKey
 */
export const storeEncryptionKeys = (keys) => {
  try {
    console.log("Storing encryption keys...");
    
    if (!keys) {
      console.error("No keys provided to store");
      return;
    }
    
    if (keys.publicKey) {
      localStorage.setItem('publicKey', keys.publicKey);
      console.log("Public key stored successfully");
    } else {
      console.warn("No public key to store");
    }
    
    if (keys.privateKey) {
      // ATTENTION: Dans une application réelle, la clé privée devrait être
      // chiffrée avant d'être stockée
      localStorage.setItem('privateKey', keys.privateKey);
      console.log("Private key stored successfully");
    } else {
      console.warn("No private key to store");
    }
  } catch (error) {
    console.error('Error storing encryption keys:', error);
  }
};

/**
 * Récupère les clés de chiffrement stockées
 * @returns {Object|null} - Objet contenant publicKey et privateKey, ou null
 */
export const getEncryptionKeys = () => {
  try {
    const publicKey = localStorage.getItem('publicKey');
    const privateKey = localStorage.getItem('privateKey');
    
    if (!publicKey || !privateKey) {
      console.warn("Missing encryption keys in storage");
      return null;
    }
    
    return { publicKey, privateKey };
  } catch (error) {
    console.error('Error retrieving encryption keys:', error);
    return null;
  }
};

/**
 * Efface les clés de chiffrement stockées
 */
export const clearEncryptionKeys = () => {
  try {
    localStorage.removeItem('publicKey');
    localStorage.removeItem('privateKey');
  } catch (error) {
    console.error('Error clearing encryption keys:', error);
  }
};
import CryptoJS from 'crypto-js';

/**
 * Generate an RSA key pair for E2E encryption
 * Note: Using CryptoJS for simplicity in this example.
 * In a real app, you'd use the WebCrypto API with RSA-OAEP
 * @returns {Promise<Object>} - Object containing public and private keys
 */
export const generateKeyPair = async () => {
  // For simplicity, we're using a proxy through the server
  // In a real app, this would use the WebCrypto API directly
  try {
    const crypto = window.crypto || window.msCrypto;
    const subtle = crypto.subtle;
    
    const keyPair = await subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    const publicKey = await subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await subtle.exportKey('pkcs8', keyPair.privateKey);
    
    return {
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
};

/**
 * Encrypt a message for a recipient using their public key
 * @param {string} message - Message to encrypt
 * @param {string} publicKeyBase64 - Recipient's public key in Base64
 * @returns {Promise<Object>} - Object containing encrypted message and key
 */
export const encryptMessage = async (message, publicKeyBase64) => {
  try {
    const crypto = window.crypto || window.msCrypto;
    const subtle = crypto.subtle;
    
    // Import recipient's public key
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    const publicKey = await subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
    
    // Generate a random symmetric key for this message
    const symmetricKey = crypto.getRandomValues(new Uint8Array(32));
    
    // Encrypt the symmetric key with the recipient's public key
    const encryptedKeyBuffer = await subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      symmetricKey
    );
    
    // Convert symmetric key to CryptoJS format
    const key = arrayBufferToWordArray(symmetricKey);
    
    // Encrypt the message with the symmetric key using AES
    const encryptedMessage = CryptoJS.AES.encrypt(message, key.toString()).toString();
    
    return {
      encryptedMessage,
      encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    };
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw new Error('Failed to encrypt message');
  }
};

/**
 * Decrypt a message using the user's private key
 * @param {string} encryptedMessage - Encrypted message
 * @param {string} encryptedKeyBase64 - Encrypted symmetric key in Base64
 * @param {string} privateKeyBase64 - User's private key in Base64
 * @returns {Promise<string>} - Decrypted message
 */
export const decryptMessage = async (encryptedMessage, encryptedKeyBase64, privateKeyBase64) => {
  try {
    if (!privateKeyBase64) {
      throw new Error('Private key not available');
    }
    
    const crypto = window.crypto || window.msCrypto;
    const subtle = crypto.subtle;
    
    // Import private key
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );
    
    // Decrypt the symmetric key with the private key
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
    const symmetricKeyBuffer = await subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedKeyBuffer
    );
    
    // Convert symmetric key to CryptoJS format
    const key = arrayBufferToWordArray(symmetricKeyBuffer);
    
    // Decrypt the message with the symmetric key
    const decryptedMessage = CryptoJS.AES.decrypt(encryptedMessage, key.toString()).toString(CryptoJS.enc.Utf8);
    
    return decryptedMessage;
  } catch (error) {
    console.error('Error decrypting message:', error);
    throw new Error('Failed to decrypt message');
  }
};

/**
 * Helper function to convert an ArrayBuffer to Base64
 * @param {ArrayBuffer} buffer - The array buffer to convert
 * @returns {string} - Base64 string
 */
function arrayBufferToBase64(buffer) {
  const binary = String.fromCharCode.apply(null, new Uint8Array(buffer));
  return window.btoa(binary);
}

/**
 * Helper function to convert Base64 to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} - Array buffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper function to convert an ArrayBuffer to a CryptoJS WordArray
 * @param {ArrayBuffer} buffer - The array buffer to convert
 * @returns {Object} - CryptoJS WordArray
 */
function arrayBufferToWordArray(buffer) {
  const words = [];
  const uint8View = new Uint8Array(buffer);
  
  for (let i = 0; i < uint8View.length; i += 4) {
    words.push(
      (uint8View[i] << 24) |
      (uint8View[i + 1] << 16) |
      (uint8View[i + 2] << 8) |
      uint8View[i + 3]
    );
  }
  
  return CryptoJS.lib.WordArray.create(words, uint8View.length);
}

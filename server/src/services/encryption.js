const crypto = require('crypto');

/**
 * Generate a new RSA key pair
 * @returns {Object} - Object containing public and private keys
 */
const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  
  return { publicKey, privateKey };
};

/**
 * Encrypt a message with a recipient's public key
 * @param {string} message - Message to encrypt
 * @param {string} publicKey - Recipient's public key
 * @returns {string} - Base64 encoded encrypted message
 */
const encryptWithPublicKey = (message, publicKey) => {
  const buffer = Buffer.from(message, 'utf-8');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    buffer
  );
  
  return encrypted.toString('base64');
};

/**
 * Decrypt a message with the user's private key
 * @param {string} encryptedMessage - Base64 encoded encrypted message
 * @param {string} privateKey - User's private key
 * @returns {string} - Decrypted message
 */
const decryptWithPrivateKey = (encryptedMessage, privateKey) => {
  const buffer = Buffer.from(encryptedMessage, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    buffer
  );
  
  return decrypted.toString('utf-8');
};

/**
 * Generate a random symmetric key for message encryption
 * @returns {string} - Base64 encoded symmetric key
 */
const generateSymmetricKey = () => {
  const key = crypto.randomBytes(32); // 256 bits
  return key.toString('base64');
};

/**
 * Encrypt a message with a symmetric key (AES-256-GCM)
 * @param {string} message - Message to encrypt
 * @param {string} key - Base64 encoded symmetric key
 * @returns {Object} - Object containing iv, encrypted message, and auth tag
 */
const encryptWithSymmetricKey = (message, key) => {
  const keyBuffer = Buffer.from(key, 'base64');
  const iv = crypto.randomBytes(12); // 96 bits
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
    tag: cipher.getAuthTag().toString('base64'),
  };
};

/**
 * Decrypt a message with a symmetric key (AES-256-GCM)
 * @param {Object} encryptedMessage - Object containing iv, encrypted message, and auth tag
 * @param {string} key - Base64 encoded symmetric key
 * @returns {string} - Decrypted message
 */
const decryptWithSymmetricKey = (encryptedMessage, key) => {
  const keyBuffer = Buffer.from(key, 'base64');
  const iv = Buffer.from(encryptedMessage.iv, 'base64');
  const tag = Buffer.from(encryptedMessage.tag, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedMessage.encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = {
  generateKeyPair,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  generateSymmetricKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
};
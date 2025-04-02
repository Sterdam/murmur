/**
 * Store user credentials in localStorage
 * @param {Object} credentials - User credentials
 */
export const storeCredentials = (credentials) => {
  if (credentials.token) {
    localStorage.setItem('token', credentials.token);
  }
  
  if (credentials.user) {
    localStorage.setItem('user', JSON.stringify(credentials.user));
  }
};

/**
 * Get stored credentials from localStorage
 * @returns {Object|null} - User credentials or null
 */
export const getCredentials = () => {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  
  if (!token || !userJson) {
    return null;
  }
  
  try {
    const user = JSON.parse(userJson);
    return { token, user };
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return null;
  }
};

/**
 * Clear stored credentials from localStorage
 */
export const clearCredentials = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

/**
 * Store encryption keys in localStorage
 * Note: In a production app, private keys should be stored in a more secure way
 * @param {Object} keys - Object containing publicKey and privateKey
 */
export const storeEncryptionKeys = (keys) => {
  if (keys.publicKey) {
    localStorage.setItem('publicKey', keys.publicKey);
  }
  
  if (keys.privateKey) {
    // WARNING: Storing private keys in localStorage is NOT secure
    // This is only for demonstration purposes
    // A real app would use a more secure storage method
    localStorage.setItem('privateKey', keys.privateKey);
  }
};

/**
 * Get stored encryption keys from localStorage
 * @returns {Object|null} - Object containing publicKey and privateKey, or null
 */
export const getEncryptionKeys = () => {
  const publicKey = localStorage.getItem('publicKey');
  const privateKey = localStorage.getItem('privateKey');
  
  if (!publicKey || !privateKey) {
    return null;
  }
  
  return { publicKey, privateKey };
};

/**
 * Clear stored encryption keys from localStorage
 */
export const clearEncryptionKeys = () => {
  localStorage.removeItem('publicKey');
  localStorage.removeItem('privateKey');
};

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { storeUser, getUserByUsername } = require('./redis');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} - User object and token
 */
const register = async (userData) => {
  const { username, password } = userData;
  
  // Check if username already exists
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    throw new Error('Username already taken');
  }
  
  // Create new user
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = {
    id: uuidv4(),
    username,
    password: hashedPassword,
    createdAt: Date.now(),
    publicKey: userData.publicKey || null,
  };
  
  // Store user in Redis
  await storeUser(newUser);
  
  // Remove password from returned user object
  const { password: _, ...userWithoutPassword } = newUser;
  
  // Generate auth token
  const token = generateToken(userWithoutPassword);
  
  return {
    user: userWithoutPassword,
    token,
  };
};

/**
 * Login an existing user
 * @param {Object} credentials - User login credentials
 * @returns {Promise<Object>} - User object and token
 */
const login = async (credentials) => {
  const { username, password } = credentials;
  
  // Get user from Redis
  const user = await getUserByUsername(username);
  if (!user) {
    throw new Error('Invalid username or password');
  }
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    throw new Error('Invalid username or password');
  }
  
  // Remove password from returned user object
  const { password: _, ...userWithoutPassword } = user;
  
  // Generate auth token
  const token = generateToken(userWithoutPassword);
  
  return {
    user: userWithoutPassword,
    token,
  };
};

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  register,
  login,
  generateToken,
  verifyToken,
};
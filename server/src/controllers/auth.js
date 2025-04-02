const { register, login } = require('../services/auth');
const { generateKeyPair } = require('../services/encryption');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.registerUser = async (req, res, next) => {
  try {
    const { username, password, publicKey } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    console.log(`Registering new user: ${username} with public key: ${publicKey ? 'provided' : 'missing'}`);
    
    // Register user with publicKey
    const userData = {
      username,
      password,
      publicKey: publicKey || null
    };
    
    try {
      const { user, token } = await register(userData);
      
      console.log(`User registered successfully: ${username}, token provided: ${!!token}`);
      
      res.status(201).json({
        success: true,
        data: { user, token },
      });
    } catch (registerError) {
      console.error(`Registration failed for ${username}:`, registerError);
      
      // Specific error handling
      if (registerError.message.includes('already taken')) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken. Please choose a different username.'
        });
      }
      
      throw registerError;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed. Please try again later.'
    });
  }
};

/**
 * Login a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    // Login user
    const { user, token } = await login({ username, password });
    
    res.status(200).json({
      success: true,
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate key pair for end-to-end encryption
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.generateKeys = async (req, res, next) => {
  try {
    // Generate RSA key pair
    const keyPair = generateKeyPair();
    
    res.status(200).json({
      success: true,
      data: keyPair,
    });
  } catch (error) {
    next(error);
  }
};

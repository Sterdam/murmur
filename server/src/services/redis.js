// server/src/services/redis.js
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

let redisClient;

/**
 * Setup Redis connection
 */
const setupRedis = () => {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      // Retry connection with exponential backoff
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
};

/**
 * Store a message in Redis
 * @param {Object} message - Message object
 * @returns {Promise<string>} - Message ID
 */
const storeMessage = async (message) => {
  const messageId = uuidv4();
  const messageData = {
    ...message,
    id: messageId,
    timestamp: message.timestamp || Date.now(),
  };
  
  await redisClient.setex(
    `messages:${messageId}`,
    60 * 60 * 24 * 7, // 7 days expiration
    JSON.stringify(messageData)
  );
  
  // Add to conversation history
  await redisClient.lpush(
    `conversation:${message.conversationId}`,
    messageId
  );
  
  // Set expiration on conversation list
  await redisClient.expire(
    `conversation:${message.conversationId}`,
    60 * 60 * 24 * 30 // 30 days
  );
  
  return messageId;
};

/**
 * Get messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Maximum number of messages to retrieve
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} - Array of messages
 */
const getConversationMessages = async (conversationId, limit = 50, offset = 0) => {
  const messageIds = await redisClient.lrange(
    `conversation:${conversationId}`,
    offset,
    offset + limit - 1
  );
  
  if (!messageIds.length) return [];
  
  const messages = await Promise.all(
    messageIds.map(async (id) => {
      const messageData = await redisClient.get(`messages:${id}`);
      return messageData ? JSON.parse(messageData) : null;
    })
  );
  
  return messages.filter(Boolean);
};

/**
 * Store user data in Redis
 * @param {Object} user - User object
 * @returns {Promise<string>} - User ID
 */
const storeUser = async (user) => {
  const userId = user.id || uuidv4();
  const userData = {
    ...user,
    id: userId,
    createdAt: user.createdAt || Date.now(),
  };
  
  await redisClient.set(
    `users:${userId}`,
    JSON.stringify(userData)
  );
  
  // Store username to ID mapping for lookups
  if (user.username) {
    await redisClient.set(`username:${user.username.toLowerCase()}`, userId);
  }
  
  return userId;
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User object
 */
const getUserById = async (userId) => {
  if (!userId) return null;
  
  const userData = await redisClient.get(`users:${userId}`);
  return userData ? JSON.parse(userData) : null;
};

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object>} - User object
 */
const getUserByUsername = async (username) => {
  if (!username) return null;
  
  // Normalize username for case-insensitive lookup
  const normalizedUsername = username.toLowerCase();
  const userId = await redisClient.get(`username:${normalizedUsername}`);
  if (!userId) return null;
  
  return getUserById(userId);
};

/**
 * Add a contact to a user's contact list
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID
 */
const addContact = async (userId, contactId) => {
  if (!userId || !contactId) return;
  
  // Add contact to user's contact list
  await redisClient.sadd(`contacts:${userId}`, contactId);
};

/**
 * Get user contacts
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of contact IDs
 */
const getUserContacts = async (userId) => {
  if (!userId) return [];
  
  return redisClient.smembers(`contacts:${userId}`);
};

/**
 * Store a contact request
 * @param {Object} request - Contact request object
 * @returns {Promise<string>} - Request ID
 */
const storeContactRequest = async (request) => {
  const requestId = request.id || uuidv4();
  const requestData = {
    ...request,
    id: requestId,
    createdAt: request.createdAt || Date.now(),
  };
  
  // Store the request with a 30-day expiration
  await redisClient.setex(
    `contact-request:${requestId}`,
    60 * 60 * 24 * 30, // 30 days
    JSON.stringify(requestData)
  );
  
  // Add to sender's outgoing requests
  await redisClient.sadd(`contact-requests:outgoing:${request.senderId}`, requestId);
  
  // Add to recipient's incoming requests
  await redisClient.sadd(`contact-requests:incoming:${request.recipientId}`, requestId);
  
  return requestId;
};

/**
 * Get a contact request by ID
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} - Contact request object
 */
const getContactRequestById = async (requestId) => {
  if (!requestId) return null;
  
  const requestData = await redisClient.get(`contact-request:${requestId}`);
  return requestData ? JSON.parse(requestData) : null;
};

/**
 * Get incoming contact requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of contact request objects
 */
const getIncomingContactRequests = async (userId) => {
  if (!userId) return [];
  
  const requestIds = await redisClient.smembers(`contact-requests:incoming:${userId}`);
  
  if (!requestIds.length) return [];
  
  const requests = await Promise.all(
    requestIds.map(async (id) => {
      const requestData = await redisClient.get(`contact-request:${id}`);
      return requestData ? JSON.parse(requestData) : null;
    })
  );
  
  // Filter out requests that don't exist
  return requests.filter(Boolean);
};

/**
 * Get outgoing contact requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of contact request objects
 */
const getOutgoingContactRequests = async (userId) => {
  if (!userId) return [];
  
  const requestIds = await redisClient.smembers(`contact-requests:outgoing:${userId}`);
  
  if (!requestIds.length) return [];
  
  const requests = await Promise.all(
    requestIds.map(async (id) => {
      const requestData = await redisClient.get(`contact-request:${id}`);
      return requestData ? JSON.parse(requestData) : null;
    })
  );
  
  // Filter out requests that don't exist
  return requests.filter(Boolean);
};

/**
 * Delete a contact request
 * @param {string} requestId - Request ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteContactRequest = async (requestId) => {
  if (!requestId) return false;
  
  // Get the request first to find sender and recipient
  const request = await getContactRequestById(requestId);
  if (!request) return false;
  
  // Remove from sender's outgoing requests
  await redisClient.srem(`contact-requests:outgoing:${request.senderId}`, requestId);
  
  // Remove from recipient's incoming requests
  await redisClient.srem(`contact-requests:incoming:${request.recipientId}`, requestId);
  
  // Delete the request itself
  await redisClient.del(`contact-request:${requestId}`);
  
  return true;
};

/**
 * Create or update a group
 * @param {Object} group - Group object
 * @returns {Promise<string>} - Group ID
 */
const storeGroup = async (group) => {
  const groupId = group.id || uuidv4();
  const groupData = {
    ...group,
    id: groupId,
    createdAt: group.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  
  await redisClient.set(
    `groups:${groupId}`,
    JSON.stringify(groupData)
  );
  
  // Add members to group
  if (group.members && Array.isArray(group.members)) {
    await redisClient.del(`group-members:${groupId}`);
    await redisClient.sadd(`group-members:${groupId}`, ...group.members);
  }
  
  return groupId;
};

/**
 * Get group by ID
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} - Group object
 */
const getGroupById = async (groupId) => {
  const groupData = await redisClient.get(`groups:${groupId}`);
  if (!groupData) return null;
  
  const group = JSON.parse(groupData);
  
  // Get members
  const members = await redisClient.smembers(`group-members:${groupId}`);
  group.members = members || [];
  
  return group;
};

/**
 * Get user groups
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of group IDs
 */
const getUserGroups = async (userId) => {
  // Get all groups
  const keys = await redisClient.keys('group-members:*');
  const groupIds = [];
  
  for (const key of keys) {
    const isMember = await redisClient.sismember(key, userId);
    if (isMember) {
      groupIds.push(key.replace('group-members:', ''));
    }
  }
  
  return groupIds;
};

module.exports = {
  setupRedis,
  storeMessage,
  getConversationMessages,
  storeUser,
  getUserById,
  getUserByUsername,
  addContact,
  getUserContacts,
  storeContactRequest,
  getContactRequestById,
  getIncomingContactRequests,
  getOutgoingContactRequests,
  deleteContactRequest,
  storeGroup,
  getGroupById,
  getUserGroups,
  redisClient, // Exported for testing purposes
};
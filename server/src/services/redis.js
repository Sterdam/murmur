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
    timestamp: Date.now(),
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
    await redisClient.set(`username:${user.username}`, userId);
  }
  
  return userId;
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User object
 */
const getUserById = async (userId) => {
  const userData = await redisClient.get(`users:${userId}`);
  return userData ? JSON.parse(userData) : null;
};

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object>} - User object
 */
const getUserByUsername = async (username) => {
  const userId = await redisClient.get(`username:${username}`);
  if (!userId) return null;
  
  return getUserById(userId);
};

/**
 * Store contact relationship
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID
 */
const addContact = async (userId, contactId) => {
  await redisClient.sadd(`contacts:${userId}`, contactId);
};

/**
 * Get user contacts
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of contact IDs
 */
const getUserContacts = async (userId) => {
  return redisClient.smembers(`contacts:${userId}`);
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
  group.members = members;
  
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
  storeGroup,
  getGroupById,
  getUserGroups,
  redisClient, // Exported for testing purposes
};
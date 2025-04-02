require('dotenv').config({ path: '../config/.env' });
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const socketIo = require('socket.io');

const routes = require('./routes');
const socketHandlers = require('./services/socket');
const errorMiddleware = require('./middleware/error');
const { setupRedis } = require('./services/redis');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Setup Redis
setupRedis();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Geo restriction middleware
const geoRestriction = require('./middleware/geoRestriction');
app.use(geoRestriction({
  blockedCountries: process.env.BLOCKED_COUNTRIES ? process.env.BLOCKED_COUNTRIES.split(',') : [],
  strictMode: process.env.GEO_STRICT_MODE === 'true'
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// API routes
app.use('/api', routes);

// Error handling middleware
app.use(errorMiddleware);

// Setup Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://murmur.app' 
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Initialize socket handlers
socketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server; // For testing purposes
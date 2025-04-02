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
const corsOptions = require('./config/cors');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Setup Redis
setupRedis();

// Security middleware
app.use(helmet({
  // Permettre les connexions depuis différentes origines
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Appliquer les options CORS configurées
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

// Ajouter un middleware pour afficher l'environnement au démarrage
app.use((req, res, next) => {
  if (req.path === '/') {
    console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS configuré pour: ${JSON.stringify(corsOptions.origin)}`);
  }
  next();
});

// Geo restriction middleware
const geoRestriction = require('./middleware/geoRestriction');
app.use(geoRestriction({
  blockedCountries: process.env.BLOCKED_COUNTRIES ? process.env.BLOCKED_COUNTRIES.split(',') : [],
  strictMode: process.env.GEO_STRICT_MODE === 'true'
}));

// Rate limiting - global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limite globale augmentée
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests, please try again later' }
});

// Rate limiting - plus strict pour les routes d'authentification (protection contre brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/register requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later' }
});

// Rate limiting - plus souple pour les routes de consultation
const viewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again after a short pause' }
});

// Appliquer les limiteurs selon les routes
app.use('/api/auth', authLimiter);
app.use('/api/users/contacts', viewLimiter);
app.use('/api/users/contact-requests', viewLimiter);
app.use('/api/messages', viewLimiter);
app.use('/api/', globalLimiter);

// API routes
app.use('/api', routes);

// Error handling middleware
app.use(errorMiddleware);

// Setup Socket.io with CORS options
const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: corsOptions.credentials
  },
});

// Initialize socket handlers
socketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = server; // For testing purposes
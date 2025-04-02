/**
 * Configuration CORS pour le serveur Express
 * Permet de gérer facilement les environnements de développement et production
 */

const isDev = process.env.NODE_ENV !== 'production';

// Configuration CORS en fonction de l'environnement
const corsOptions = {
  // En développement, autoriser localhost
  development: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  
  // En production, n'autoriser que le domaine principal
  production: {
    origin: [
      'https://murmur.app', 
      'https://www.murmur.app',
      // Ajoutez d'autres domaines autorisés si nécessaire
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
};

// Exporter la configuration correspondant à l'environnement
module.exports = isDev ? corsOptions.development : corsOptions.production;
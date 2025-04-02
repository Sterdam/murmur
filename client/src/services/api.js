// client/src/services/api.js - Corrigé
import axios from 'axios';
import envConfig from '../config/env';

// Configuration de base de l'API
// Utilisation des variables d'environnement pour l'URL de base
const baseURL = process.env.REACT_APP_API_URL || envConfig.apiUrl || 'http://localhost:5000/api';

// Debug log pour vérifier l'URL utilisée
console.log('API URL:', baseURL);
console.log('Environment:', process.env.NODE_ENV);
console.log('REACT_APP_ENV:', process.env.REACT_APP_ENV);

// Création de l'instance axios avec la configuration initiale
const api = axios.create({
  baseURL,
  timeout: 15000, // 15 secondes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur de requêtes pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    // Vérification que config et config.headers existent
    if (!config) {
      console.error('API request config is undefined');
      return Promise.reject(new Error('API request config is undefined'));
    }
    
    // Initialiser headers s'il n'existe pas
    if (!config.headers) {
      config.headers = {};
    }
    
    // Récupération du token depuis le localStorage
    const token = localStorage.getItem('token');
    
    // Ajout du token à l'en-tête d'autorisation si disponible
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('API request error:', error);
    return Promise.reject(error);
  }
);

// Stockage des dernières requêtes pour éviter le trop grand nombre d'appels
const requestCache = new Map();
const CACHE_TTL = 5000; // 5 secondes entre les requêtes identiques

// Intercepteur de réponses pour gérer les erreurs courantes
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Gestion spécifique des erreurs HTTP
    if (error.response) {
      // Gestion du code 401 (non autorisé)
      if (error.response.status === 401) {
        // Effacer les données locales
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Rediriger vers la page de connexion si on n'y est pas déjà
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register') {
          window.location.href = '/login';
        }
      }
      
      // Gestion spécifique de l'erreur 429 (trop de requêtes)
      if (error.response.status === 429) {
        console.warn('Rate limit hit, request throttled:', error.config?.url);
        
        // Si les données sont dans le cache, utiliser la version en cache
        const cacheKey = error.config?.url;
        if (cacheKey && requestCache.has(cacheKey)) {
          const cachedData = requestCache.get(cacheKey);
          console.log('Using cached data for', cacheKey);
          return Promise.resolve(cachedData);
        }
      }
      
      // Gestion des autres codes d'erreur
      console.error(
        `API Error ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`
      );
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('No response received:', error.request);
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('Request configuration error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Intercepteur de requête pour la gestion du cache - CORRIGÉ
api.interceptors.request.use(
  (config) => {
    // S'assurer que config existe et qu'il contient method
    if (!config || !config.method) {
      console.error('Invalid API request config:', config);
      return config || {};
    }
    
    // Si c'est une requête GET, vérifier le cache
    if (config.method.toLowerCase() === 'get' && config.url) {
      const cacheKey = config.url;
      const now = Date.now();
      
      // Vérifier si la requête est dans le cache et encore fraîche
      if (requestCache.has(cacheKey)) {
        const { timestamp, response } = requestCache.get(cacheKey);
        
        // Si le cache est encore valide (moins de X secondes)
        if (now - timestamp < CACHE_TTL) {
          console.log('Found response in cache for', cacheKey);
          
          // Marquer cette config comme devant utiliser une réponse en cache
          // au lieu de faire une vraie requête
          config.adapter = (config) => {
            return Promise.resolve({
              data: response.data,
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              config: config,
              request: {}
            });
          };
        }
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponse pour mettre à jour le cache - CORRIGÉ
api.interceptors.response.use(
  (response) => {
    // S'assurer que response et response.config existent
    if (response && response.config && response.config.method) {
      // Mettre en cache les réponses GET réussies
      if (response.config.method.toLowerCase() === 'get' && response.config.url) {
        const cacheKey = response.config.url;
        requestCache.set(cacheKey, {
          timestamp: Date.now(),
          response: {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          }
        });
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Exporter l'URL de base pour référence
export const getBaseUrl = () => baseURL;

export default api;
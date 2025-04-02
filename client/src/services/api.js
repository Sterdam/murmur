// client/src/services/api.js - Corrigé
import axios from 'axios';
import envConfig from '../config/env';

// Configuration de base de l'API
// Utilisation des variables d'environnement pour l'URL de base
const baseURL = process.env.REACT_APP_API_URL || envConfig.apiUrl;

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

// Exporter l'URL de base pour référence
export const getBaseUrl = () => baseURL;

export default api;
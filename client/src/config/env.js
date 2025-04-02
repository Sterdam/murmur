// Configuration des environnements
const config = {
    development: {
      apiUrl: 'http://localhost:5000/api',
      socketUrl: 'http://localhost:5000',
      basePath: '/',
      socketPath: '/socket.io'
    },
    production: {
      apiUrl: 'https://api.murmur.app/api',
      socketUrl: 'https://api.murmur.app',
      basePath: '/',
      socketPath: '/socket.io'
    }
  };
  
  // Déterminer l'environnement actuel
  // En développement, utilisez la variable NODE_ENV de webpack/Create React App
  const getEnvironment = () => {
    // Si vous avez défini une variable REACT_APP_ENV, utilisez-la en priorité
    if (process.env.REACT_APP_ENV) {
      return process.env.REACT_APP_ENV;
    }
    
    // Sinon, utilisez NODE_ENV (development, production, test)
    return process.env.NODE_ENV || 'development';
  };
  
  // Exporter la configuration de l'environnement actuel
  const env = getEnvironment();
  export default config[env] || config.development;
  
  // Méthode utilitaire pour vérifier si on est en développement
  export const isDevelopment = () => env === 'development';
  
  // Méthode utilitaire pour vérifier si on est en production
  export const isProduction = () => env === 'production';
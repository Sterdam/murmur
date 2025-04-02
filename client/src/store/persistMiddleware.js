// client/src/store/persistMiddleware.js
/**
 * Middleware pour persister les messages dans le localStorage
 * Cela permet de conserver les conversations même après rafraîchissement
 */

// Définir quelles parties du store doivent être persistées
const PERSISTED_KEYS = ['messages.conversations'];

// Fonction utilitaire pour obtenir une propriété imbriquée
const getNestedProperty = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Fonction utilitaire pour définir une propriété imbriquée
const setNestedProperty = (obj, path, value) => {
  const parts = path.split('.');
  const lastPart = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[lastPart] = value;
};

// Charger l'état persisté depuis localStorage
export const loadPersistedState = () => {
  try {
    const persistedState = {};
    
    PERSISTED_KEYS.forEach(key => {
      const savedValue = localStorage.getItem(`murmur_${key}`);
      if (savedValue) {
        setNestedProperty(persistedState, key, JSON.parse(savedValue));
      }
    });
    
    console.log('État persisté chargé:', Object.keys(persistedState));
    return persistedState;
  } catch (err) {
    console.warn('Échec du chargement de l\'état persisté:', err);
    return {};
  }
};

// Créer le middleware de persistance
export const createPersistMiddleware = () => {
  return store => next => action => {
    // Appeler la méthode dispatch suivante dans la chaîne
    const result = next(action);
    
    // Après les changements d'état, persister les parties spécifiées dans localStorage
    const state = store.getState();
    
    // Ne sauvegarder qu'après ces actions spécifiques pour réduire la charge
    if (
      action.type.startsWith('messages/') ||
      action.type === 'REHYDRATE_STORE'
    ) {
      PERSISTED_KEYS.forEach(key => {
        const valueToSave = getNestedProperty(state, key);
        if (valueToSave !== undefined) {
          try {
            localStorage.setItem(`murmur_${key}`, JSON.stringify(valueToSave));
          } catch (err) {
            // En cas d'erreur (par exemple, dépassement de quota), on continue
            console.warn(`Impossible de sauvegarder ${key} dans localStorage:`, err);
          }
        }
      });
    }
    
    return result;
  };
};

// Action pour réhydrater le store
export const rehydrateStoreAction = () => ({
  type: 'REHYDRATE_STORE'
});
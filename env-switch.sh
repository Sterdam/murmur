#!/bin/bash

# Script pour basculer facilement entre les environnements de développement et production

MODE=$1
CURRENT_DIR=$(pwd)
CLIENT_DIR="$CURRENT_DIR/client"
ENV_FILE="$CLIENT_DIR/.env"
ENV_DEV_FILE="$CLIENT_DIR/.env.development"
ENV_PROD_FILE="$CLIENT_DIR/.env.production"

# Vérifier que l'environnement est spécifié
if [ -z "$MODE" ]; then
  echo "Usage: $0 [dev|prod]"
  echo "  dev  : Configure pour le développement local (localhost)"
  echo "  prod : Configure pour la production (murmur.app)"
  exit 1
fi

# Vérifier que le mode est valide
if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
  echo "Mode invalide: $MODE"
  echo "Modes valides: dev, prod"
  exit 1
fi

# Vérifier que les fichiers d'environnement existent
if [ ! -f "$ENV_DEV_FILE" ]; then
  echo "Erreur: Fichier $ENV_DEV_FILE non trouvé"
  exit 1
fi

if [ ! -f "$ENV_PROD_FILE" ]; then
  echo "Erreur: Fichier $ENV_PROD_FILE non trouvé"
  exit 1
fi

# Basculer vers l'environnement spécifié
if [ "$MODE" = "dev" ]; then
  echo "Configuration pour l'environnement de développement (localhost)"
  # Créer un nouveau fichier .env pour le développement
  cat > "$ENV_FILE" << EOL
SKIP_PREFLIGHT_CHECK=true
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
CI=false
NODE_ENV=development
REACT_APP_ENV=development
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
EOL
  echo "Environnement configuré pour le développement"
else
  echo "Configuration pour l'environnement de production (murmur.app)"
  # Créer un nouveau fichier .env pour la production
  cat > "$ENV_FILE" << EOL
SKIP_PREFLIGHT_CHECK=true
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
CI=false
NODE_ENV=production
REACT_APP_ENV=production
REACT_APP_API_URL=https://api.murmur.app/api
REACT_APP_SOCKET_URL=https://api.murmur.app
EOL
  echo "Environnement configuré pour la production"
fi

# Afficher un résumé
echo ""
echo "✅ Configuration terminée !"
echo "Pour que les changements prennent effet :"
echo "1. Arrêtez le serveur de développement (Ctrl+C)"
echo "2. Redémarrez le serveur avec 'npm start' ou 'yarn start'"
echo ""
echo "Environnement actuel : $MODE"
echo "Variables d'environnement configurées :"
cat "$ENV_FILE"
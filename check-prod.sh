#!/bin/bash

# Script pour simuler et tester la configuration de production

echo "==== Test de la configuration de production ===="

# Configurer l'environnement de production
./env-switch.sh prod

# Créer un fichier temporaire de build
BUILD_DIR="./client/build_test"
mkdir -p $BUILD_DIR

echo "🔍 Vérification de la configuration..."

# Vérifier les fichiers de configuration
if [ -f "./client/.env" ]; then
    echo "✅ Fichier .env trouvé"
    echo "  Configuration actuelle:"
    cat "./client/.env"
else
    echo "❌ Fichier .env manquant"
fi

echo ""
echo "🔗 Vérification des paramètres d'API:"
ENDPOINT=$(grep REACT_APP_API_URL ./client/.env | cut -d= -f2)
echo "  Endpoint API: $ENDPOINT"

# Test d'accessibilité de l'API
echo ""
echo "🌐 Test de la connexion à l'API de production..."
curl -s -o /dev/null -w "  Code de statut: %{http_code}\n" "$ENDPOINT" || echo "  Impossible de se connecter à l'API"

echo ""
echo "🔧 Configuration pour la production:"
echo "  1. Variables d'environnement configurées pour la production"
echo "  2. Pour déployer en production:"
echo "     - Exécutez 'npm run build' dans le dossier client"
echo "     - Déployez le contenu du dossier build sur votre serveur web"
echo "     - Configurez le serveur backend avec les variables d'environnement appropriées"

echo ""
echo "Pour revenir en mode développement, exécutez: ./env-switch.sh dev"

# Nettoyage
rm -rf $BUILD_DIR
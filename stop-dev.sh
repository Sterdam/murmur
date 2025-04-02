#!/bin/bash

# Script pour arrêter l'application en mode développement

echo "==== Arrêt de Murmur en mode développement ===="

# Vérifier si Docker est utilisé
if command -v docker &> /dev/null && docker-compose ps | grep -q "Up"; then
    echo "🐳 Arrêt des conteneurs Docker..."
    docker-compose down
    echo "✅ Conteneurs Docker arrêtés"
else
    # Arrêter les processus locaux
    if [ -f .dev-pids ]; then
        echo "🛑 Arrêt des services locaux..."
        read SERVER_PID CLIENT_PID < .dev-pids
        kill $SERVER_PID $CLIENT_PID 2>/dev/null
        rm .dev-pids
        echo "✅ Services locaux arrêtés"
    else
        echo "⚠️ Aucun service en cours d'exécution trouvé"
    fi
    
    # Arrêter Redis si nécessaire
    if command -v redis-cli &> /dev/null; then
        echo "Arrêt de Redis..."
        redis-cli shutdown
    fi
fi

echo ""
echo "Environnement de développement arrêté"
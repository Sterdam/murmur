#!/bin/bash

# Script pour démarrer l'application en mode développement

echo "==== Démarrage de Murmur en mode développement ===="

# Configurer l'environnement de développement
./env-switch.sh dev

# Vérifier si Docker est installé
if command -v docker &> /dev/null; then
    echo "🐳 Docker détecté, utilisation du mode Docker"
    
    # Lancer l'application avec Docker en mode développement
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d
    
    echo "✅ Services Docker démarrés"
    echo "📊 Serveur API: http://localhost:5000"
    echo "🌐 Client: http://localhost:3000"
    echo "Pour afficher les logs: docker-compose logs -f"
else
    echo "📦 Docker non détecté, démarrage des services locaux"
    
    # Démarrer le serveur Redis si disponible
    if command -v redis-server &> /dev/null; then
        echo "Démarrage de Redis..."
        redis-server --daemonize yes
    else
        echo "⚠️ Redis n'est pas installé. Certaines fonctionnalités peuvent ne pas fonctionner."
    fi
    
    # Démarrer le serveur backend
    echo "Démarrage du serveur backend..."
    cd server && npm run dev &
    SERVER_PID=$!
    
    # Démarrer le client frontend
    echo "Démarrage du client frontend..."
    cd client && npm start &
    CLIENT_PID=$!
    
    # Enregistrer les PIDs pour pouvoir arrêter proprement
    echo "$SERVER_PID $CLIENT_PID" > .dev-pids
    
    echo "✅ Services démarrés"
    echo "📊 Serveur API: http://localhost:5000"
    echo "🌐 Client: http://localhost:3000"
    echo "Pour arrêter: ./stop-dev.sh"
fi

echo ""
echo "Application prête pour le développement !"
echo "Mode: développement local"
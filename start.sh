#!/bin/bash

echo "==== Démarrage de l'application Murmur ===="
echo "Création d'une version fonctionnelle de l'application..."

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "Docker n'est pas installé. Veuillez installer Docker avant de continuer."
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose n'est pas installé. Veuillez installer Docker Compose avant de continuer."
    exit 1
fi

# Créer les dossiers nécessaires
mkdir -p ./data/redis

# Créer un docker-compose simplifié
cat > docker-compose.simple.yml << 'EOF'
version: '3.8'

services:
  # Service Redis pour le stockage des données
  redis:
    image: redis:alpine
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - murmur_network

  # Service backend (API et websockets)
  server:
    build: ./server
    restart: always
    depends_on:
      - redis
    environment:
      - NODE_ENV=production
      - PORT=5000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=murmur_secret_key_change_in_production
      - ENCRYPTION_KEY=murmur_encryption_key_change_in_production
    networks:
      - murmur_network

  # Service frontend
  client:
    build:
      context: ./client
      dockerfile: Dockerfile.static
    restart: always
    depends_on:
      - server
    networks:
      - murmur_network

  # Service proxy pour router les requêtes
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - client
      - server
    networks:
      - murmur_network

networks:
  murmur_network:

volumes:
  redis_data:
EOF

# Créer un fichier nginx.conf de base
cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;

    # Frontend
    location / {
        proxy_pass http://client:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Backend
    location /api {
        proxy_pass http://server:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSockets
    location /socket.io {
        proxy_pass http://server:5000;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Lancer l'application
echo "Lancement de l'application..."
docker-compose -f docker-compose.simple.yml up -d

# Vérifier si le démarrage a réussi
if [ $? -eq 0 ]; then
    echo "==== Application démarrée avec succès ===="
    
    # Attendre que les services démarrent
    echo "Attente du démarrage des services..."
    sleep 5
    
    # Vérifier si les conteneurs sont en cours d'exécution
    RUNNING_CONTAINERS=$(docker-compose -f docker-compose.simple.yml ps -q | wc -l)
    
    if [ "$RUNNING_CONTAINERS" -ge 3 ]; then
        echo "✅ Tous les services sont en cours d'exécution"
        echo "L'application Murmur est maintenant accessible à l'adresse: http://localhost"
        echo
        echo "Informations utiles:"
        echo "- Interface utilisateur: http://localhost"
        echo "- API: http://localhost/api"
        echo "- Pour arrêter l'application: docker-compose -f docker-compose.simple.yml down"
        echo "- Pour afficher les logs: docker-compose -f docker-compose.simple.yml logs -f"
        echo
        echo "Merci d'utiliser Murmur - Une messagerie sécurisée et respectueuse de la vie privée"
    else
        echo "⚠️ Certains services n'ont pas démarré correctement"
        echo "Exécutez 'docker-compose -f docker-compose.simple.yml logs' pour plus d'informations"
    fi
else
    echo "❌ Échec du démarrage de l'application"
    echo "Veuillez vérifier votre installation Docker et réessayer"
    exit 1
fi
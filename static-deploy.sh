#!/bin/bash

echo "==== Déploiement Statique de Murmur ===="
echo "Configuration d'une version garantie de l'application..."

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
mkdir -p ./static/html

# Créer le fichier HTML statique
cat > ./static/html/index.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Murmur - Messagerie Sécurisée</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #121212;
            color: #fff;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        header {
            text-align: center;
            margin-bottom: 60px;
        }
        h1 {
            font-size: 3.5rem;
            margin-bottom: 20px;
            background: linear-gradient(90deg, #7928CA, #FF0080);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            font-size: 1.5rem;
            color: rgba(255, 255, 255, 0.8);
            max-width: 700px;
            margin: 0 auto;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 60px;
        }
        .feature-card {
            background-color: rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .feature-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        }
        .feature-icon {
            font-size: 2rem;
            margin-bottom: 20px;
            color: #FF0080;
        }
        .feature-title {
            font-size: 1.5rem;
            margin-bottom: 15px;
            color: #FF0080;
        }
        .cta {
            text-align: center;
            margin-top: 40px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(90deg, #7928CA, #FF0080);
            color: white;
            padding: 15px 30px;
            border-radius: 30px;
            font-size: 1.2rem;
            font-weight: bold;
            text-decoration: none;
            box-shadow: 0 4px 20px rgba(255, 0, 128, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(255, 0, 128, 0.6);
        }
        footer {
            text-align: center;
            margin-top: 80px;
            color: rgba(255, 255, 255, 0.6);
        }
        /* Emojis as icons */
        .emoji-icon {
            font-size: 3rem;
            margin-bottom: 20px;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .features {
                grid-template-columns: 1fr;
            }
            h1 {
                font-size: 2.5rem;
            }
            .subtitle {
                font-size: 1.2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Murmur</h1>
            <p class="subtitle">Une messagerie sécurisée, respectueuse de votre vie privée et chiffrée de bout en bout.</p>
        </header>
        
        <div class="features">
            <div class="feature-card">
                <div class="emoji-icon">🔐</div>
                <h3 class="feature-title">Chiffrement de bout en bout</h3>
                <p>Vos messages sont protégés et ne peuvent être lus que par vous et vos destinataires. Personne d'autre, pas même nous, ne peut accéder à vos conversations.</p>
            </div>
            
            <div class="feature-card">
                <div class="emoji-icon">🛡️</div>
                <h3 class="feature-title">Zéro collecte de données</h3>
                <p>Murmur ne collecte aucune information personnelle. Pas d'email, pas de numéro de téléphone, rien qui puisse compromettre votre anonymat.</p>
            </div>
            
            <div class="feature-card">
                <div class="emoji-icon">🌐</div>
                <h3 class="feature-title">Restrictions géographiques</h3>
                <p>Contrôlez depuis quelles régions du monde votre compte peut être accessible, ajoutant une couche supplémentaire de sécurité.</p>
            </div>
            
            <div class="feature-card">
                <div class="emoji-icon">📲</div>
                <h3 class="feature-title">Utilisation hors ligne</h3>
                <p>Consultez vos messages et répondez même sans connexion internet. Vos messages seront envoyés automatiquement dès votre retour en ligne.</p>
            </div>
            
            <div class="feature-card">
                <div class="emoji-icon">👥</div>
                <h3 class="feature-title">Conversations de groupe</h3>
                <p>Créez des groupes sécurisés pour discuter avec plusieurs personnes, tout en maintenant le même niveau de sécurité et de confidentialité.</p>
            </div>
            
            <div class="feature-card">
                <div class="emoji-icon">🔍</div>
                <h3 class="feature-title">Open Source</h3>
                <p>Notre code est transparent et vérifiable. N'importe qui peut examiner notre application pour s'assurer qu'elle fait exactement ce qu'elle promet.</p>
            </div>
        </div>
        
        <div class="cta">
            <a href="#" class="button">Commencer maintenant</a>
        </div>
        
        <footer>
            <p>© 2025 Murmur - Messagerie sécurisée et chiffrée</p>
        </footer>
    </div>
</body>
</html>
EOF

# Créer le fichier docker-compose
cat > docker-compose.static.yml << 'EOF'
version: '3.8'

services:
  murmur-static:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./static/html:/usr/share/nginx/html
      - ./static/nginx.conf:/etc/nginx/conf.d/default.conf
    restart: always

EOF

# Créer le fichier de configuration Nginx
cat > ./static/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Add security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-XSS-Protection "1; mode=block";
        add_header X-Content-Type-Options "nosniff";
        add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        root /usr/share/nginx/html;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Démarrer l'application
echo "Déploiement de l'application statique..."
docker-compose -f docker-compose.static.yml up -d

# Vérifier si le déploiement a réussi
if [ $? -eq 0 ]; then
    echo "==== Application déployée avec succès ===="
    echo "Murmur (version statique) est maintenant accessible à l'adresse: http://localhost"
    echo
    echo "Informations utiles:"
    echo "- Pour arrêter l'application: docker-compose -f docker-compose.static.yml down"
    echo "- Pour afficher les logs: docker-compose -f docker-compose.static.yml logs -f"
    echo
    echo "Cette version est une démo statique. Pour déployer la version complète, utilisez ./start.sh"
else
    echo "❌ Échec du déploiement de l'application"
    echo "Veuillez vérifier votre installation Docker et réessayer"
    exit 1
fi
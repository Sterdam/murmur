# Murmur - Messagerie Sécurisée

Murmur est une application de messagerie sécurisée avec chiffrement de bout en bout, conçue pour protéger la vie privée des utilisateurs.

## Caractéristiques

- Chiffrement de bout en bout
- Zéro collecte de données personnelles
- Restrictions géographiques configurables
- Mode hors ligne avec synchronisation automatique
- Conversations individuelles et de groupe
- Interface utilisateur moderne et responsive
- Application PWA pour utilisation sur mobile

## Structure du projet

- **client** : Application React (frontend)
- **server** : API Node.js (backend)
- **config** : Fichiers de configuration
- **docker** : Configurations Docker

## Prérequis

- Docker et Docker Compose
- Node.js (v16 ou plus) pour le développement

## Installation rapide

Utilisez le script de déploiement pour lancer une version statique de l'application :

```bash
chmod +x static-deploy.sh
./static-deploy.sh
```

Cette commande lancera une version statique de l'application qui sera accessible à l'adresse http://localhost.

## Installation complète

Pour déployer la version complète de l'application (backend + frontend) :

```bash
chmod +x start.sh
./start.sh
```

## Architecture

### Client
- React avec Redux pour la gestion d'état
- Styled-components pour le style
- PWA avec service worker pour le fonctionnement hors ligne
- Chiffrement côté client avec CryptoJS

### Serveur
- Node.js avec Express
- Socket.io pour la messagerie en temps réel
- Redis pour le stockage des données
- Middleware de restriction géographique
- API RESTful

## Sécurité

- Chiffrement de bout en bout pour toutes les communications
- Aucune donnée utilisateur stockée en clair
- Restrictions géographiques pour limiter les points d'accès
- Authentification sans email ni téléphone pour préserver l'anonymat

## Licence

Ce projet est sous licence MIT.

## Auteurs

Créé par l'équipe Murmur.

---

*Murmur - La messagerie qui respecte votre vie privée*
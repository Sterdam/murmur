FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Environment variables
ENV NODE_ENV=development

EXPOSE 5000

# Utiliser npm run dev pour le développement (si défini dans le package.json)
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then npm run dev; else npm start; fi"]
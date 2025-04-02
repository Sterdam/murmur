const fs = require('fs');
const path = require('path');

// Créer une version de l'index qui n'utilise pas de service worker
console.log('Creating fallback build without service worker...');

try {
  // Renommer index.js pour sauvegarder l'original
  fs.renameSync(
    path.join(__dirname, 'src/index.js'),
    path.join(__dirname, 'src/index.original.js')
  );

  // Utiliser la version sans service worker
  fs.copyFileSync(
    path.join(__dirname, 'src/index-no-sw.js'),
    path.join(__dirname, 'src/index.js')
  );

  console.log('Fallback index.js is now in place.');
  console.log('Run "npm run build:react" to build without service worker');
} catch (error) {
  console.error('Error creating fallback:', error);
  process.exit(1);
}
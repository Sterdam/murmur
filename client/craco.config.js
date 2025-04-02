module.exports = {
  // PWA configuration with workbox
  webpack: {
    configure: (webpackConfig) => {
      // Configure workbox
      const workboxPlugin = webpackConfig.plugins.find(
        (plugin) => plugin.constructor.name === 'InjectManifest'
      );
      
      if (workboxPlugin) {
        workboxPlugin.config.maximumFileSizeToCacheInBytes = 5 * 1024 * 1024; // 5MB
      }
      
      // Résoudre les problèmes de dépendances manquantes
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        path: require.resolve('path-browserify')
      };
      
      return webpackConfig;
    },
  },
  // Enable TypeScript and ESLint configuration
  typescript: {
    enableTypeChecking: true,
  },
  eslint: {
    enable: true,
    mode: 'extends',
    configure: {
      extends: ['react-app'],
      rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      },
    },
  },
};
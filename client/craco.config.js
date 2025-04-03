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
      
      // Désactiver le plugin React Refresh en production
      if (process.env.NODE_ENV === 'production') {
        const babelLoader = webpackConfig.module.rules.find(
          (rule) => rule.oneOf && Array.isArray(rule.oneOf)
        ).oneOf.find(
          (rule) => rule.loader && rule.loader.includes('babel-loader')
        );
        
        if (babelLoader && babelLoader.options && babelLoader.options.plugins) {
          babelLoader.options.plugins = babelLoader.options.plugins.filter(
            (plugin) => !Array.isArray(plugin) || !plugin[0].includes('react-refresh')
          );
        }
      }
      
      return webpackConfig;
    },
  },
  // Babel configuration
  babel: {
    plugins: [
      process.env.NODE_ENV === 'production' 
        ? null 
        : ['react-refresh/babel', { skipEnvCheck: true }]
    ].filter(Boolean),
  },
  // Enable TypeScript and ESLint configuration
  typescript: {
    enableTypeChecking: true,
  },
  eslint: {
    enable: false, // Disable ESLint for build
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
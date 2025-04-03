// This is a helper file for webpack configuration.
// CRACO will still be the main configuration tool.
// This file is just to provide overrides if needed.

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  // Override the webpack configuration to remove React Refresh in production
  webpack: (config) => {
    if (isProduction) {
      // Filter out ReactRefreshPlugin in production
      if (config.plugins) {
        config.plugins = config.plugins.filter((plugin) => {
          return plugin.constructor.name !== 'ReactRefreshPlugin';
        });
      }
    
      // Remove react-refresh/babel from babel-loader configuration
      if (config.module && config.module.rules) {
        config.module.rules.forEach((rule) => {
          if (rule.use && Array.isArray(rule.use)) {
            rule.use.forEach((loader) => {
              if (loader.loader && loader.loader.includes('babel-loader') && loader.options && loader.options.plugins) {
                loader.options.plugins = loader.options.plugins.filter((plugin) => {
                  return !(Array.isArray(plugin) && plugin[0] && plugin[0].includes('react-refresh'));
                });
              }
            });
          }
        });
      }
    }
    
    return config;
  },
};
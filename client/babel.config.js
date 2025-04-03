module.exports = function(api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  const presets = [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['>0.2%', 'not dead', 'not op_mini all']
        }
      }
    ],
    '@babel/preset-react'
  ];
  
  const plugins = [];
  
  // Only apply React Refresh in development
  if (!isProduction) {
    plugins.push(['react-refresh/babel', { skipEnvCheck: true }]);
  }
  
  return {
    presets,
    plugins
  };
};
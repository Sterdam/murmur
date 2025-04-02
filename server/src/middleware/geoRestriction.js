const { getUserById } = require('../services/redis');

/**
 * Middleware to restrict access based on geographical location
 * Uses the X-Forwarded-For header or the client's IP address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {Object} options - Configuration options
 * @param {Array} options.blockedCountries - Array of country codes to block
 * @param {Array} options.allowedCountries - Array of country codes to allow (overrides blockedCountries)
 * @param {Boolean} options.strictMode - If true, blocks requests with unknown location
 */
module.exports = (options = {}) => {
  const {
    blockedCountries = [],
    allowedCountries = [],
    strictMode = false
  } = options;

  return async (req, res, next) => {
    try {
      // Get client IP address
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                 req.connection.remoteAddress;
      
      if (!ip || ip === '127.0.0.1' || ip === '::1') {
        // Local development - allow access
        return next();
      }

      // In a production environment, you would use a geo-IP service here
      // This is a placeholder for the actual implementation
      const geoData = await getGeoLocation(ip);
      
      // If user's country code is in allowedCountries, allow access
      if (allowedCountries.length > 0 && geoData.countryCode && 
          allowedCountries.includes(geoData.countryCode)) {
        return next();
      }
      
      // If user's country is in blockedCountries, block access
      if (blockedCountries.length > 0 && geoData.countryCode && 
          blockedCountries.includes(geoData.countryCode)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Service not available in your region',
        });
      }
      
      // If strict mode is enabled and country is unknown, block access
      if (strictMode && !geoData.countryCode) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Unable to verify your location',
        });
      }

      // If user is authenticated, check for additional restrictions
      if (req.user) {
        const user = await getUserById(req.user.id);
        
        // Check if the user's allowed regions match their current location
        if (user.allowedRegions && user.allowedRegions.length > 0) {
          if (!user.allowedRegions.includes(geoData.countryCode)) {
            return res.status(403).json({
              success: false,
              message: 'Access denied: Unusual location detected',
            });
          }
        }
      }
      
      // Allow access if no restrictions apply
      next();
    } catch (error) {
      console.error('GeoRestriction error:', error);
      
      // In case of error, the default behavior depends on strictMode
      if (strictMode) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Unable to verify your location',
        });
      }
      
      // If not in strict mode, allow access despite the error
      next();
    }
  };
};

/**
 * Placeholder function for geo-IP lookup
 * In production, replace with a real geo-IP service like MaxMind, ipstack, etc.
 * @param {String} ip - IP address to look up
 * @returns {Promise<Object>} - Geographic information
 */
async function getGeoLocation(ip) {
  // This is a placeholder. In production, implement a real geo-IP lookup
  // Examples of services: MaxMind, ipstack, IP-API, etc.
  
  // For demo purposes, randomly return a country code
  // REMOVE THIS IN PRODUCTION
  const demoCountries = ['US', 'CA', 'GB', 'FR', 'DE', 'JP', 'AU', null];
  const randomIndex = Math.floor(Math.random() * demoCountries.length);
  
  return {
    ip,
    countryCode: demoCountries[randomIndex],
    countryName: 'Unknown',
    city: 'Unknown',
    latitude: 0,
    longitude: 0,
    timezone: 'Unknown'
  };
}
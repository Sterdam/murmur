// Empty implementation for the React Refresh Signature function
if (process.env.NODE_ENV !== 'production') {
  // Only include in development
  if (typeof window !== 'undefined') {
    window.$RefreshSig$ = function () {
      let status = 'active';
      const savedType = {};
      return function (type) {
        if (status !== 'active') {
          return type;
        }
        if (type === savedType.current) {
          return savedType.current;
        }
        savedType.current = type;
        return savedType.current;
      };
    };

    window.$RefreshReg$ = function() {};
  }
}
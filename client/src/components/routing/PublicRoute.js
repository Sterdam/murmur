import React from 'react';
import { Navigate } from 'react-router-dom';

const PublicRoute = ({ children, isAuthenticated }) => {
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

export default PublicRoute;
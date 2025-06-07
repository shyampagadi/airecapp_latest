import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('ProtectedRoute: Checking authentication status...');
        const result = await getCurrentUser();
        console.log('ProtectedRoute: Authentication check result:', result.success);
        setIsAuthenticated(result.success);
      } catch (error) {
        console.error('ProtectedRoute: Error checking authentication:', error);
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkAuth();
  }, []);

  // In development mode, allow access even if authentication fails
  const useDevelopmentFallback = process.env.NODE_ENV === 'development' && authChecked && !isAuthenticated;
  
  if (useDevelopmentFallback) {
    console.log('ProtectedRoute: Using development fallback - allowing access without authentication');
    return <Outlet />;
  }

  if (isAuthenticated === null && !authChecked) {
    // Still loading
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute; 
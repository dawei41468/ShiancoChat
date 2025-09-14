import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { setAuthHeader, login as apiLogin, register as apiRegister, getCurrentUser } from './services/apiService';
import { useCurrentUser } from '@/hooks/authHooks';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token'));

  // React Query: get current user from server state and sync into context
  const { data: rqUser, error: rqUserError } = useCurrentUser({ enabled: !!token });
  useEffect(() => {
    if (rqUser) {
      setUser(rqUser);
    }
  }, [rqUser]);

  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        setAuthHeader(accessToken);
        try {
          // Let React Query populate user; still attempt to validate/refresh token on mount
          setToken(accessToken);
        } catch (error) {
          // If token is invalid, try to refresh
          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const refreshResponse = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100'}/api/auth/refresh`,
                { refresh_token: refreshToken }
              );
              const { access_token } = refreshResponse.data;
              localStorage.setItem('access_token', access_token);
              setAuthHeader(access_token);
              setToken(access_token);
              // user will be fetched by React Query after token update
            } else {
              throw error;
            }
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setToken(null);
            setUser(null);
            setAuthHeader(null);
          }
        }
      }
    };
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const response = await apiLogin(email, password);
    const { access_token, refresh_token } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setToken(access_token);
    setAuthHeader(access_token);
    // user will be hydrated by React Query automatically
  };

  const register = async (userData) => {
    await apiRegister(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    setAuthHeader(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

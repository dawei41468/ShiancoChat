import React, { createContext, useState, useEffect } from 'react';
import { setAuthHeader, login as apiLogin, logout as apiLogout, register as apiRegister, getCurrentUser, refreshAccessToken } from './services/apiService';

export const AuthContext = createContext();

/**
 * Authentication context provider.
 * Manages user session using HttpOnly cookies (backend) with in-memory token state.
 * On mount, attempts to restore the session by calling /api/auth/users/me.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /** Clears local auth state without calling the backend. */
    const clearAuthState = () => {
      setToken(null);
      setUser(null);
      setAuthHeader(null);
    };

    window.addEventListener('auth:session-expired', clearAuthState);

    /** Validates the current session on app mount. */
    const initializeAuth = async () => {
      try {
        const userResponse = await getCurrentUser();
        setUser(userResponse.data);
      } catch (error) {
        // If not authenticated, user stays null
        setUser(null);
      }
      setIsLoading(false);
    };
    initializeAuth();
    return () => window.removeEventListener('auth:session-expired', clearAuthState);
  }, []);

  /**
   * Logs in the user with email and password.
   * Backend sets HttpOnly cookies; frontend stores access_token in memory.
   * @param {string} email
   * @param {string} password
   */
  const login = async (email, password) => {
    const response = await apiLogin(email, password);
    const { access_token } = response.data;
    setToken(access_token);
    const userResponse = await getCurrentUser();
    setUser(userResponse.data);
  };

  /**
   * Registers a new user.
   * @param {Object} userData
   */
  const register = async (userData) => {
    await apiRegister(userData);
  };

  /** Logs out the user and clears cookies via the backend. */
  const logout = async () => {
    await apiLogout();
    setAuthHeader(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, isLoading, login, logout, register }}>
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

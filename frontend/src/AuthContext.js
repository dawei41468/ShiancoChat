import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { setAuthHeader, login as apiLogin, register as apiRegister, getCurrentUser } from './services/apiService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      setAuthHeader(token);
      getCurrentUser()
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setAuthHeader(null);
        });
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await apiLogin(email, password);
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setAuthHeader(access_token);
    const userResponse = await getCurrentUser();
    setUser(userResponse.data);
  };

  const register = async (userData) => {
    await apiRegister(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
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

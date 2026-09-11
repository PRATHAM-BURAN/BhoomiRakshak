import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
      } catch (err) {
        console.warn('Session expired or token invalid:', err.message);
        setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (identifier, password) => {
    const res = await api.login(identifier, password);
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const loginOtp = async (phone, otp) => {
    const res = await api.loginOtp(phone, otp);
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const setupAdmin = async (payload) => {
    const res = await api.setupAdmin(payload);
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const registerCitizen = async (payload) => {
    const res = await api.registerCitizen(payload);
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        updateUser: (updatedData) => setUser(prev => prev ? ({ ...prev, ...updatedData }) : updatedData),
        role: user ? user.role : 'guest',
        isAuthenticated: Boolean(user),
        loading,
        login,
        loginOtp,
        setupAdmin,
        registerCitizen,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

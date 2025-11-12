import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginSAP, logoutSAP } from '../services/sapService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión guardada al iniciar
  useEffect(() => {
    const savedSession = localStorage.getItem('sapSession');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setSession(parsed);
      } catch (error) {
        console.error('Error al cargar sesión guardada:', error);
        localStorage.removeItem('sapSession');
      }
    }
    setLoading(false);
  }, []);

  const login = async (userName, password) => {
    try {
      setLoading(true);
      const sessionData = await loginSAP(userName, password);
      
      // Guardar sesión en localStorage
      localStorage.setItem('sapSession', JSON.stringify(sessionData));
      setSession(sessionData);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Error al iniciar sesión' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (session?.sessionId) {
      await logoutSAP(session.sessionId);
    }
    localStorage.removeItem('sapSession');
    setSession(null);
  };

  const isAuthenticated = !!session;

  const value = {
    session,
    login,
    logout,
    isAuthenticated,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


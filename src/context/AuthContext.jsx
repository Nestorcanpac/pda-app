import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as loginService, getSession, logout as logoutService, checkBackendStatus } from '../services/auth.service';

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
  const [backendAvailable, setBackendAvailable] = useState(null); // null = no verificado, true/false = verificado

  // Verificar backend y sesión al iniciar
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        // Primero verificar que el backend esté disponible
        console.log('[AuthContext] Verificando backend...');
        const backendStatus = await checkBackendStatus();
        console.log('[AuthContext] Estado del backend:', backendStatus);
        setBackendAvailable(backendStatus.available);
        
        if (backendStatus.available) {
          // Si el backend está disponible, verificar si hay sesión activa
          // Si falla getSession, no es crítico, solo significa que no hay sesión activa
          try {
            console.log('[AuthContext] Verificando sesión...');
            const sessionInfo = await getSession();
            console.log('[AuthContext] Información de sesión:', sessionInfo);
            if (sessionInfo.hasSession) {
              setSession(sessionInfo.session);
            } else {
              setSession(null);
            }
          } catch (error) {
            console.warn('[AuthContext] No se pudo verificar sesión (no crítico):', error);
            // No marcar el backend como no disponible si solo falla getSession
            // Puede ser que simplemente no haya sesión activa
            setSession(null);
          }
        } else {
          // Backend no disponible
          console.warn('[AuthContext] Backend no disponible:', backendStatus.message);
          setSession(null);
        }
      } catch (error) {
        console.error('[AuthContext] Error en initializeAuth:', error);
        setBackendAvailable(false);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (CompanyDB, UserName, Password) => {
    try {
      setLoading(true);
      
      // Verificar backend primero
      const backendStatus = await checkBackendStatus();
      if (!backendStatus.available) {
        return {
          success: false,
          error: backendStatus.message || 'Backend no disponible',
        };
      }

      // Intentar login
      const result = await loginService(CompanyDB, UserName, Password);
      
      if (result.success) {
        // Si el login fue exitoso, obtener información de la sesión
        const sessionInfo = await getSession();
        if (sessionInfo.hasSession) {
          setSession(sessionInfo.session);
        }
        return { success: true };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Error al iniciar sesión',
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutService();
      setSession(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Aun así, limpiar el estado local
      setSession(null);
    }
  };

  const refreshSession = async () => {
    try {
      const sessionInfo = await getSession();
      if (sessionInfo.hasSession) {
        setSession(sessionInfo.session);
        return true;
      } else {
        setSession(null);
        return false;
      }
    } catch (error) {
      console.error('Error al refrescar sesión:', error);
      setSession(null);
      return false;
    }
  };

  const isAuthenticated = !!session?.hasSession;

  const value = {
    session,
    login,
    logout,
    refreshSession,
    isAuthenticated,
    loading,
    backendAvailable,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


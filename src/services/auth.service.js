import apiClient from './api.service';

/**
 * Verifica que el backend esté disponible
 * @returns {Promise<{available: boolean, message?: string}>}
 */
export const checkBackendStatus = async () => {
  try {
    console.log('[checkBackendStatus] Iniciando verificación del backend...');
    console.log('[checkBackendStatus] URL base:', apiClient.defaults.baseURL);
    console.log('[checkBackendStatus] URL completa:', apiClient.defaults.baseURL + '/api/ping');
    
    const response = await apiClient.get('/api/ping');
    
    console.log('[checkBackendStatus] ✅ Respuesta recibida exitosamente');
    console.log('[checkBackendStatus] Respuesta completa:', response);
    console.log('[checkBackendStatus] response.status:', response.status);
    console.log('[checkBackendStatus] response.data:', response.data);
    console.log('[checkBackendStatus] response.data.ok:', response.data?.ok);
    
    if (response && response.data && response.data.ok === true) {
      console.log('[checkBackendStatus] ✅ Backend operativo');
      return { available: true, message: response.data.message || 'Backend operativo' };
    }
    
    // Si response.data existe pero ok no es true, loggear para debug
    console.warn('[checkBackendStatus] ⚠️ Respuesta inesperada:', response.data);
    return { available: false, message: 'Backend no responde correctamente' };
  } catch (error) {
    console.error('[checkBackendStatus] Error completo:', error);
    console.error('[checkBackendStatus] Error response:', error.response);
    console.error('[checkBackendStatus] Error data:', error.response?.data);
    console.error('[checkBackendStatus] Error request:', error.request);
    console.error('[checkBackendStatus] Error message:', error.message);
    console.error('[checkBackendStatus] Error code:', error.code);
    
    let errorMessage = 'Error al verificar backend';
    
    if (error.isNetworkError) {
      if (error.isCorsError) {
        errorMessage = 'Error de CORS. El backend no permite peticiones desde este origen.';
      } else {
        errorMessage = `No se pudo conectar al backend. Verifica que:
1. El backend esté corriendo en localhost:3001
2. Ngrok esté activo y funcionando
3. No haya problemas de firewall o red`;
      }
    } else if (error.response) {
      errorMessage = `Error ${error.response.status}: ${error.response.statusText || error.message}`;
    } else {
      errorMessage = error.message || 'Error desconocido al verificar backend';
    }
    
    return { 
      available: false, 
      message: errorMessage
    };
  }
};

/**
 * Inicia sesión en el Service Layer a través del backend proxy
 * @param {string} CompanyDB - Base de datos de la compañía
 * @param {string} UserName - Nombre de usuario
 * @param {string} Password - Contraseña
 * @returns {Promise<{success: boolean, error?: string, session?: object}>}
 */
export const login = async (CompanyDB, UserName, Password) => {
  try {
    console.log('[login] Iniciando login con:', { CompanyDB, UserName, Password: '***' });
    
    const requestBody = {
      CompanyDB,
      UserName,
      Password,
    };
    
    console.log('[login] Body que se envía:', JSON.stringify(requestBody, null, 2));
    console.log('[login] URL completa:', apiClient.defaults.baseURL + '/api/login');
    
    const response = await apiClient.post('/api/login', requestBody);
    
    console.log('[login] Respuesta recibida:', response);
    console.log('[login] response.data:', response.data);
    console.log('[login] response.status:', response.status);

    // El backend retorna { ok: true } en caso de éxito
    if (response.data && response.data.ok === true) {
      console.log('[login] Login exitoso');
      return { 
        success: true,
        // El backend maneja las cookies automáticamente, no necesitamos retornar nada más
      };
    }

    // Si el backend retorna ok: false
    console.warn('[login] Login fallido, respuesta:', response.data);
    return {
      success: false,
      error: response.data?.error || 'Error al iniciar sesión',
    };
  } catch (error) {
    console.error('[login] Error completo:', error);
    console.error('[login] Error response:', error.response);
    console.error('[login] Error data:', error.response?.data);
    console.error('[login] Error status:', error.response?.status);
    console.error('[login] Error message:', error.message);
    console.error('[login] Error code:', error.code);
    
    // Manejo de errores
    if (error.isNetworkError) {
      return {
        success: false,
        error: 'No se pudo conectar al backend. Verifica la conexión y que el backend esté accesible.',
      };
    }

    // Si hay una respuesta del servidor pero con error
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || error.message || `Error ${error.response.status}: ${error.response.statusText}`,
      };
    }

    // Error del backend (ya viene formateado del interceptor)
    return {
      success: false,
      error: error.message || 'Error al iniciar sesión',
    };
  }
};

/**
 * Obtiene información de la sesión actual
 * @returns {Promise<{hasSession: boolean, session?: object, error?: string}>}
 */
export const getSession = async () => {
  try {
    const response = await apiClient.get('/api/session');

    if (response.data && response.data.ok) {
      const sessionData = response.data.session;
      return {
        hasSession: sessionData?.hasSession || false,
        session: sessionData,
      };
    }

    return {
      hasSession: false,
      error: response.data?.error || 'No se pudo obtener información de la sesión',
    };
  } catch (error) {
    if (error.isNetworkError) {
      return {
        hasSession: false,
        error: 'No se pudo conectar al backend',
      };
    }

    // Si el error es 401 o similar, probablemente no hay sesión
    if (error.status === 401 || error.status === 403) {
      return {
        hasSession: false,
        error: 'No hay sesión activa',
      };
    }

    return {
      hasSession: false,
      error: error.message || 'Error al verificar sesión',
    };
  }
};

/**
 * Cierra la sesión (si el backend tiene endpoint de logout)
 * Por ahora, el backend no tiene logout, pero dejamos la función por si se añade
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const logout = async () => {
  try {
    // Si el backend tiene endpoint de logout, lo usaríamos aquí
    // Por ahora, simplemente retornamos éxito
    // El backend puede limpiar la sesión automáticamente después de un tiempo
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Error al cerrar sesión',
    };
  }
};


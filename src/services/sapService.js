// Configuración del Service Layer de SAP B1
// En desarrollo, usar el proxy de Vite. En producción, usar la URL directa
const SAP_BASE_URL = import.meta.env.DEV 
  ? '/api/b1s/v1'  // Proxy de Vite en desarrollo
  : 'https://srvhana:50000/b1s/v1';  // URL directa en producción (HTTPS)
const COMPANY_DB = 'ZZZ_SBOHEIS_22042025';

/**
 * Realiza login en el Service Layer de SAP B1
 * @param {string} userName - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Promise<Object>} Objeto con SessionId y otros datos de sesión
 */
export const loginSAP = async (userName, password) => {
  try {
    const loginUrl = `${SAP_BASE_URL}/Login`;
    console.log('Intentando login a:', loginUrl);
    console.log('Modo:', import.meta.env.DEV ? 'DESARROLLO (usando proxy)' : 'PRODUCCIÓN (URL directa)');
    console.log('Datos:', { CompanyDB: COMPANY_DB, UserName: userName });
    
    const response = await fetch(`${SAP_BASE_URL}/Login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CompanyDB: COMPANY_DB,
        UserName: userName,
        Password: password,
      }),
    });

    console.log('Respuesta recibida. Status:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('Error data:', errorData);
        
        // Intentar extraer el mensaje de error de diferentes formatos posibles
        if (errorData.error) {
          if (errorData.error.message) {
            errorMessage = errorData.error.message.value || errorData.error.message || errorMessage;
          } else if (errorData.error.code) {
            errorMessage = `Error ${errorData.error.code}: ${errorData.error.message || errorMessage}`;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        console.error('Error al parsear respuesta de error:', parseError);
        const textError = await response.text().catch(() => '');
        console.error('Respuesta de error (texto):', textError);
        if (textError) {
          errorMessage += ` - ${textError}`;
        }
      }
      
      const fullError = new Error(errorMessage);
      fullError.status = response.status;
      throw fullError;
    }

    const data = await response.json();
    console.log('Login exitoso. SessionId:', data.SessionId);
    
    return {
      sessionId: data.SessionId,
      version: data.Version,
      sessionTimeout: data.SessionTimeout,
      baseUrl: SAP_BASE_URL,
      companyDB: COMPANY_DB,
    };
  } catch (error) {
    console.error('Error completo en login SAP:', error);
    
    // Manejar errores de red/CORS
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Error de conexión: No se pudo conectar al servidor SAP. Verifica que el servidor esté accesible y que no haya problemas de CORS.');
    }
    
    // Si el error ya tiene un mensaje, lanzarlo tal cual
    if (error.message) {
      throw error;
    }
    
    // Error genérico
    throw new Error(error.toString() || 'Error desconocido al intentar iniciar sesión');
  }
};

/**
 * Realiza una petición autenticada al Service Layer
 * @param {string} endpoint - Endpoint relativo (ej: '/Items')
 * @param {string} sessionId - SessionId de la sesión activa
 * @param {Object} options - Opciones adicionales para fetch (method, body, etc.)
 * @returns {Promise<Object>} Respuesta de la API
 */
export const sapRequest = async (endpoint, sessionId, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${SAP_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'B1SESSION': sessionId,
    },
    ...options,
  };

  console.log('sapRequest - URL:', url);
  console.log('sapRequest - Method:', defaultOptions.method || 'GET');
  console.log('sapRequest - Headers:', defaultOptions.headers);
  console.log('sapRequest - Body:', defaultOptions.body);

  try {
    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      let errorData;
      try {
        const text = await response.text();
        console.error('Error response text:', text);
        errorData = JSON.parse(text);
      } catch (e) {
        errorData = {};
      }
      console.error('Error response data:', errorData);
      const errorMessage = errorData.error?.message?.value || 
                          errorData.error?.message || 
                          errorData.message || 
                          `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en petición SAP:', error);
    throw error;
  }
};

/**
 * Cierra la sesión en el Service Layer
 * @param {string} sessionId - SessionId de la sesión a cerrar
 * @returns {Promise<void>}
 */
export const logoutSAP = async (sessionId) => {
  try {
    await fetch(`${SAP_BASE_URL}/Logout`, {
      method: 'POST',
      headers: {
        'B1SESSION': sessionId,
      },
    });
  } catch (error) {
    console.error('Error en logout SAP:', error);
    // No lanzamos error porque el logout puede fallar si la sesión ya expiró
  }
};

// Exportar constantes para uso en otros módulos
export { SAP_BASE_URL, COMPANY_DB };


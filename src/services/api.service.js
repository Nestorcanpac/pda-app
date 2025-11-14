import axios from 'axios';

// Obtener la URL base del backend desde variables de entorno
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://joline-furred-evelyne.ngrok-free.dev';

// Log de la URL configurada (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('[API Config] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('[API Config] API_BASE_URL final:', API_BASE_URL);
}

// Crear instancia de axios configurada
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 35000, // 35 segundos (un poco más que el timeout del backend)
  headers: {
    'Content-Type': 'application/json',
    // Header para saltarse la página de advertencia de ngrok
    'ngrok-skip-browser-warning': 'true',
  },
  withCredentials: false, // El backend maneja las cookies, no necesitamos enviarlas
});

// Interceptor para requests
apiClient.interceptors.request.use(
  (config) => {
    // Asegurar que el header de ngrok esté presente
    if (!config.headers['ngrok-skip-browser-warning']) {
      config.headers['ngrok-skip-browser-warning'] = 'true';
    }
    
    // Log de requests en desarrollo
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
        headers: config.headers,
        data: config.data,
        params: config.params,
      });
    }
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Interceptor para responses
apiClient.interceptors.response.use(
  (response) => {
    // Log de responses en desarrollo
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  (error) => {
    // Manejo centralizado de errores
    if (error.response) {
      // El servidor respondió con un código de error
      const { status, data } = error.response;
      console.error(`[API Error] ${status} ${error.config?.url}`, data);
      
      // Si el error viene del backend en formato { ok: false, error: "..." }
      if (data && typeof data === 'object' && data.ok === false) {
        const errorMessage = new Error(data.error || 'Error del servidor');
        errorMessage.status = status;
        errorMessage.data = data;
        return Promise.reject(errorMessage);
      }
      
      // Error HTTP estándar
      const errorMessage = new Error(data?.error || data?.message || `Error ${status}: ${error.response.statusText}`);
      errorMessage.status = status;
      errorMessage.data = data;
      return Promise.reject(errorMessage);
    } else if (error.request) {
      // La petición se hizo pero no hubo respuesta (backend no disponible)
      console.error('[API Error] Sin respuesta del servidor', {
        request: error.request,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
        errorMessage: error.message,
        errorCode: error.code,
      });
      
      // Verificar si es un error de CORS
      if (error.message && (error.message.includes('CORS') || error.message.includes('cors') || error.code === 'ERR_NETWORK')) {
        // ERR_NETWORK puede ser CORS o conexión bloqueada
        const errorMessage = new Error('Error de conexión. Puede ser CORS o el servidor no está accesible. Verifica que el backend tenga CORS habilitado para este origen.');
        errorMessage.isNetworkError = true;
        errorMessage.isCorsError = true;
        return Promise.reject(errorMessage);
      }
      
      const errorMessage = new Error(`No se pudo conectar al servidor en ${API_BASE_URL}. Verifica que: 1) El backend esté corriendo en localhost:3001, 2) Ngrok esté activo, 3) El backend tenga CORS habilitado.`);
      errorMessage.isNetworkError = true;
      return Promise.reject(errorMessage);
    } else {
      // Error al configurar la petición
      console.error('[API Error] Error de configuración', error.message, error);
      return Promise.reject(error);
    }
  }
);

export default apiClient;


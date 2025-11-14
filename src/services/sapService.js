// Configuración del Service Layer de SAP B1
// En desarrollo: usa proxy de Vite
// En producción: intenta usar localStorage, si no, usa valor por defecto
// Nota: Si "srvhana" no se resuelve, usar la IP del servidor (ej: http://192.168.1.100:50000/b1s/v1)
const getSapBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '/api/b1s/v1';  // Proxy de Vite en desarrollo
  }
  
  // En producción, intentar leer de localStorage primero
  try {
    const savedUrl = localStorage.getItem('sap_server_url');
    if (savedUrl && savedUrl.trim()) {
      console.log('🔧 Usando URL guardada en localStorage:', savedUrl);
      return savedUrl.trim();
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage:', e);
  }
  
  // Valor por defecto: usar IP del servidor SAP
  // srvhana resuelve a 192.168.0.52
  // Usando HTTP para evitar problemas de certificado SSL
  // Chrome NO permite desactivar verificación SSL desde JavaScript (limitación de seguridad)
  // Si el servidor NO acepta HTTP, necesitarás configurar el servidor para que acepte HTTP
  // o usar un certificado SSL válido
  return 'http://192.168.0.52:50000/b1s/v1';
};

// Función para obtener la URL dinámicamente (se llama en cada petición)
export const getSapBaseUrlDynamic = () => getSapBaseUrl();

const COMPANY_DB = 'ZZZ_SBOHEIS_22042025';

// Log de la URL configurada (solo en producción para debugging)
if (!import.meta.env.DEV) {
  const url = getSapBaseUrl();
  console.log('🔧 SAP Base URL configurada:', url);
  console.log('🔧 Fuente:', localStorage.getItem('sap_server_url') ? 'localStorage' : (import.meta.env.VITE_SAP_BASE_URL ? 'variable de entorno' : 'valor por defecto'));
}

/**
 * Realiza login en el Service Layer de SAP B1
 * @param {string} userName - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Promise<Object>} Objeto con SessionId y otros datos de sesión
 */
export const loginSAP = async (userName, password) => {
  // Obtener la URL dinámicamente (fuera del try para que esté disponible en el catch)
  const baseUrl = getSapBaseUrlDynamic();
  const loginUrl = `${baseUrl}/Login`;
  
  try {
    console.log('Intentando login a:', loginUrl);
    console.log('Modo:', import.meta.env.DEV ? 'DESARROLLO (usando proxy)' : 'PRODUCCIÓN (URL directa)');
    console.log('Datos:', { CompanyDB: COMPANY_DB, UserName: userName });
    
    // En producción con HTTPS, intentar activar la excepción del certificado usando un iframe
    if (!import.meta.env.DEV && loginUrl.startsWith('https://')) {
      try {
        console.log('Intentando activar excepción de certificado SSL usando iframe...');
        // Crear un iframe oculto para "activar" la excepción del certificado
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.src = baseUrl;
        document.body.appendChild(iframe);
        
        // Esperar un momento para que el iframe cargue (o falle con el certificado)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Remover el iframe
        document.body.removeChild(iframe);
        console.log('Iframe removido, intentando login...');
      } catch (iframeError) {
        // Ignorar errores del iframe
        console.log('Error con iframe (puede ser normal):', iframeError);
      }
    }
    
    // Opciones de fetch con headers iguales a Postman
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'User-Agent': 'PDA-App/1.0',
      },
      body: JSON.stringify({
        CompanyDB: COMPANY_DB,
        UserName: userName,
        Password: password,
      }),
      // En producción, intentar con mode: 'cors' o 'no-cors' según sea necesario
      mode: 'cors',
      credentials: 'omit',
    };

    console.log('Opciones de fetch:', {
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      mode: fetchOptions.mode,
      url: loginUrl
    });

    let response;
    try {
      response = await fetch(loginUrl, fetchOptions);
      console.log('Respuesta recibida. Status:', response.status, response.statusText);
    } catch (fetchError) {
      // Si falla el fetch, puede ser SSL o CORS
      console.error('Error en fetch:', fetchError);
      // Intentar con no-cors para ver si es CORS
      if (fetchError.message.includes('Failed to fetch') && !import.meta.env.DEV) {
        console.log('Intentando con mode: no-cors...');
        try {
          const noCorsResponse = await fetch(loginUrl, {
            ...fetchOptions,
            mode: 'no-cors'
          });
          console.log('Respuesta no-cors:', noCorsResponse);
          throw new Error('La petición se completó pero no se puede leer la respuesta (probablemente CORS bloqueado). El servidor debe permitir peticiones desde el origen de la aplicación.');
        } catch (noCorsError) {
          throw fetchError; // Lanzar el error original
        }
      }
      throw fetchError;
    }

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      let errorDetails = '';
      
      try {
        // Intentar leer como JSON primero
        const errorData = await response.json();
        console.error('Error data (JSON):', errorData);
        errorDetails = JSON.stringify(errorData, null, 2);
        
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
        console.error('Error al parsear respuesta de error como JSON:', parseError);
        // Si no es JSON, leer como texto
        try {
          const textError = await response.text();
          console.error('Respuesta de error (texto):', textError);
          errorDetails = textError;
          if (textError) {
            errorMessage += `\n\nDetalles: ${textError}`;
          }
        } catch (textError) {
          console.error('No se pudo leer la respuesta de error');
        }
      }
      
      // Para Bad Request (400), mostrar información detallada
      if (response.status === 400) {
        errorMessage = `Bad Request (400): La petición no es válida.\n\nURL: ${loginUrl}\nMétodo: POST\nHeaders enviados: ${JSON.stringify(fetchOptions.headers, null, 2)}\nBody enviado: ${JSON.stringify({CompanyDB: COMPANY_DB, UserName: userName, Password: '***'}, null, 2)}\n\nDetalles del error del servidor:\n${errorDetails || 'Sin detalles adicionales'}\n\nPosibles causas:\n- El servidor requiere HTTPS en lugar de HTTP\n- El formato del body no es correcto\n- Faltan headers requeridos\n- Los datos de login son incorrectos\n\nSOLUCIÓN: Si el servidor requiere HTTPS, necesitas configurar el servidor SAP para que también acepte HTTP, o usar un certificado SSL válido.`;
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
      baseUrl: getSapBaseUrlDynamic(),
      companyDB: COMPANY_DB,
    };
  } catch (error) {
    console.error('Error completo en login SAP:', error);
    console.error('URL intentada:', loginUrl);
    console.error('Modo:', import.meta.env.DEV ? 'DESARROLLO' : 'PRODUCCIÓN');
    
    // Manejar errores de red/CORS/SSL
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      const urlInfo = `URL intentada: ${loginUrl}`;
      const modeInfo = `Modo: ${import.meta.env.DEV ? 'DESARROLLO (proxy)' : 'PRODUCCIÓN (directo)'}`;
      const errorDetails = `Error original: ${error.message}\nStack: ${error.stack || 'N/A'}`;
      
      // Detectar si es un error de SSL
      const isSSLError = error.message.includes('certificate') || 
                        error.message.includes('SSL') || 
                        error.message.includes('TLS') ||
                        error.message.includes('ERR_CERT') ||
                        loginUrl.startsWith('https://');
      
      console.error('Detalles completos del error:', error);
      console.error('¿Es error de SSL?', isSSLError);
      
      let errorMessage = `Error de conexión: No se pudo conectar al servidor SAP.\n${urlInfo}\n${modeInfo}\n\n${errorDetails}`;
      
      if (isSSLError) {
        errorMessage += `\n\n⚠️ PROBLEMA DE CERTIFICADO SSL DETECTADO\n\nChrome NO permite peticiones fetch con certificados SSL inválidos, incluso si aceptaste el certificado navegando manualmente.\n\nEsto es diferente a Postman porque:\n- Postman NO es un navegador y puede ignorar certificados SSL\n- Chrome SÍ es un navegador y bloquea certificados inválidos en fetch por seguridad\n\nSOLUCIONES:\n\n1. Configurar el servidor SAP para que tenga un certificado SSL válido (recomendado)\n\n2. O configurar CORS en el servidor SAP para permitir peticiones desde:\n   Origen: https://nestorcanpac.github.io\n   Métodos: POST, GET, OPTIONS\n   Headers: Content-Type, Accept, B1SESSION\n\n3. O usar un proxy intermedio que maneje el SSL\n\nNOTA: Aceptar el certificado navegando manualmente NO funciona para peticiones fetch desde JavaScript.`;
      } else {
        errorMessage += `\n\n⚠️ PROBLEMA DE CONECTIVIDAD DE RED DETECTADO\n\n"No se puede acceder a este sitio Web" significa que la PDA no puede alcanzar el servidor.\n\nPOSIBLES CAUSAS:\n\n1. La PDA no está en la misma red que el servidor\n   - Verifica que la PDA esté conectada a la misma red WiFi que el servidor\n   - La IP del servidor es: 192.168.0.52\n   - La PDA debe estar en la red 192.168.0.x\n\n2. Firewall bloqueando la conexión\n   - Verifica que el puerto 50000 esté abierto en el servidor\n   - Verifica que el firewall del servidor permita conexiones desde la PDA\n\n3. El servidor SAP solo acepta conexiones desde ciertas IPs\n   - Verifica la configuración del servidor SAP\n   - Puede que necesites agregar la IP de la PDA a la lista de IPs permitidas\n\n4. Problema de red/VPN\n   - Si usas VPN, desactívala temporalmente\n   - Verifica que no haya restricciones de red corporativa\n\nSOLUCIÓN:\n1. Verifica que la PDA esté en la misma red WiFi que el servidor (192.168.0.x)\n2. Desde la PDA, intenta hacer ping a 192.168.0.52 (si es posible)\n3. Verifica que el puerto 50000 esté abierto en el servidor\n4. Contacta al administrador del servidor SAP para verificar restricciones de acceso`;
      }
      
      throw new Error(errorMessage);
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
  // Obtener la URL dinámicamente
  const baseUrl = getSapBaseUrlDynamic();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  
  // Headers iguales a Postman (incluyendo B1SESSION para autenticación)
  const defaultOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'User-Agent': 'PDA-App/1.0',
      'B1SESSION': sessionId,
      // Permitir sobrescribir headers si se pasan en options
      ...(options.headers || {}),
    },
  };

  console.log('sapRequest - URL:', url);
  console.log('sapRequest - Method:', defaultOptions.method || 'GET');
  console.log('sapRequest - Headers:', defaultOptions.headers);
  console.log('sapRequest - Body:', defaultOptions.body);

  // Agregar opciones adicionales para producción
  const finalOptions = {
    ...defaultOptions,
    mode: 'cors',
    credentials: 'omit',
  };

  console.log('Opciones finales de fetch:', {
    url,
    method: finalOptions.method || 'GET',
    headers: finalOptions.headers,
    mode: finalOptions.mode
  });

  try {
    const response = await fetch(url, finalOptions);

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
    console.error('URL intentada:', url);
    
    // Mejorar mensaje de error para errores de red
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      const urlInfo = `URL intentada: ${url}`;
      const modeInfo = `Modo: ${import.meta.env.DEV ? 'DESARROLLO (proxy)' : 'PRODUCCIÓN (directo)'}`;
      throw new Error(`Error de conexión: No se pudo conectar al servidor SAP.\n${urlInfo}\n${modeInfo}\n\nVerifica:\n- Que el servidor esté accesible desde la PDA\n- Que la URL sea correcta\n- Que no haya problemas de CORS o firewall`);
    }
    
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
    const baseUrl = getSapBaseUrlDynamic();
    await fetch(`${baseUrl}/Logout`, {
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
export { COMPANY_DB };

// Función para guardar la URL del servidor
export const setSapServerUrl = (url) => {
  try {
    if (url && url.trim()) {
      // Asegurar que termine en /b1s/v1
      let cleanUrl = url.trim();
      if (!cleanUrl.endsWith('/b1s/v1')) {
        if (cleanUrl.endsWith('/')) {
          cleanUrl += 'b1s/v1';
        } else {
          cleanUrl += '/b1s/v1';
        }
      }
      localStorage.setItem('sap_server_url', cleanUrl);
      console.log('✅ URL del servidor guardada:', cleanUrl);
      return true;
    } else {
      localStorage.removeItem('sap_server_url');
      console.log('✅ URL del servidor eliminada (se usará valor por defecto)');
      return true;
    }
  } catch (e) {
    console.error('Error al guardar URL del servidor:', e);
    return false;
  }
};

// Función para obtener la URL actual del servidor
export const getSapServerUrl = () => {
  try {
    return localStorage.getItem('sap_server_url') || '';
  } catch (e) {
    return '';
  }
};


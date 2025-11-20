import apiClient from './api.service';

/**
 * Ejecuta una SQLQuery en el Service Layer a través del backend proxy
 * @param {string} queryName - Nombre de la query (ej: 'GetStockByBin')
 * @param {object} parameters - Parámetros de la query como objeto plano (ej: { binCode: 'UBI-001' })
 * @returns {Promise<any>} Datos retornados por la query
 * @throws {Error} Si hay error al ejecutar la query
 */
export const executeQuery = async (queryName, parameters = {}) => {
  try {
    console.log(`[executeQuery] Query: ${queryName}`, 'Parameters:', parameters);
    
    const response = await apiClient.post(`/api/query/${queryName}`, parameters);
    
    console.log(`[executeQuery] Response para ${queryName}:`, response.data);

    // El backend retorna { ok: true, data: {...} } en caso de éxito
    if (response.data && response.data.ok) {
      return response.data.data;
    }

    // Si el backend retorna ok: false
    throw new Error(response.data?.error || `Error al ejecutar la query ${queryName}`);
  } catch (error) {
    console.error(`[executeQuery] Error en ${queryName}:`, error);
    console.error(`[executeQuery] Error completo:`, {
      message: error.message,
      status: error.status,
      data: error.data,
      response: error.response?.data,
    });
    
    // Si es error de red
    if (error.isNetworkError) {
      throw new Error('No se pudo conectar al backend. Verifica la conexión y que el backend esté accesible.');
    }

    // Si es error de sesión (401, 403)
    if (error.status === 401 || error.status === 403) {
      throw new Error('Sesión expirada o no hay sesión activa. Debe hacer login primero.');
    }

    // Error del backend (ya viene formateado del interceptor)
    throw error;
  }
};

/**
 * Ejecuta la query pda_stockLoteStatus
 * Formato según SAP B1 Service Layer: { "ParamList": "binCode='valor'" }
 * @param {string} binCode - Código del bin (ej: '19-A5-1-9-5')
 * @returns {Promise<any>} Datos del stock en el bin con información de lote y estado
 */
export const getStockByBin = async (binCode) => {
  // Enviar parámetros como objeto plano - el backend los transformará al formato SAP
  // El backend recibirá { binCode: 'valor' } y lo transformará a { ParamList: "binCode='valor'" }
  return executeQuery('pda_stockLoteStatus', { binCode });
};

/**
 * Ejecuta la query pda_codigoUbi para consultar información de una ubicación
 * @param {string} binCode - Código del bin (ej: '01-DER-0-1-0')
 * @returns {Promise<any>} Datos de la ubicación (AbsEntry, BinCode, WhsCode)
 */
export const getBinCode = async (binCode) => {
  return executeQuery('pda_codigoUbi', { binCode });
};

/**
 * Ejecuta la query pda_getLotes para consultar información de lotes
 * Formato según SAP B1 Service Layer: { "ParamList": "lote='valor'" }
 * @param {string} lote - Número de lote (ej: 'nestor00')
 * @returns {Promise<any>} Datos del lote con información de ubicaciones y cantidades
 */
export const getLotes = async (lote) => {
  // Enviar parámetros como objeto plano - el backend los transformará al formato SAP
  // El backend recibirá { lote: 'valor' } y lo transformará a { ParamList: "lote='valor'" }
  return executeQuery('pda_getLotes', { lote });
};

/**
 * Ejecuta la query pda_getByLote para consultar información por lote
 * Formato según SAP B1 Service Layer: { "ParamList": "lote='valor'" }
 * @param {string} lote - Número de lote (ej: 'nestor01')
 * @returns {Promise<any>} Datos del lote con información de ubicaciones y cantidades
 */
export const getByLote = async (lote) => {
  // Enviar parámetros como objeto plano - el backend los transformará al formato SAP
  // El backend recibirá { lote: 'valor' } y lo transformará a { ParamList: "lote='valor'" }
  return executeQuery('pda_getByLote', { lote });
};

/**
 * Obtiene información de un empleado por CardNumber desde la API OData directa
 * @param {string} cardNumber - Código de tarjeta del empleado (ej: '2208')
 * @returns {Promise<any>} Datos del empleado o null si no se encuentra
 */
export const getEmployeeByCardNumber = async (cardNumber) => {
  try {
    console.log(`[getEmployeeByCardNumber] Consultando empleado con CardNumber: ${cardNumber}`);
    
    // URL directa de la API OData
    const baseUrl = 'http://192.168.0.155:8080';
    const filter = `$filter=CardNumber eq '${cardNumber}'`;
    const url = `${baseUrl}/odata4/Employee?${filter}`;
    
    console.log(`[getEmployeeByCardNumber] URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[getEmployeeByCardNumber] Respuesta para CardNumber ${cardNumber}:`, data);
    
    // La respuesta tiene formato { value: [...] }
    if (data && data.value && Array.isArray(data.value) && data.value.length > 0) {
      return data.value[0]; // Retornar el primer resultado
    }
    
    return null;
  } catch (error) {
    console.error(`[getEmployeeByCardNumber] Error al consultar empleado para CardNumber ${cardNumber}:`, error);
    throw error;
  }
};

/**
 * Obtiene información de ItemVersion desde la API OData directa
 * @param {string} itemCode - Código del item (ej: 'C-00004')
 * @returns {Promise<any>} Datos del ItemVersion con UDF1 (cantidad por caja)
 */
export const getItemVersion = async (itemCode) => {
  try {
    console.log(`[getItemVersion] Consultando ItemVersion para: ${itemCode}`);
    
    // URL directa de la API OData
    const baseUrl = 'http://192.168.0.155:8080';
    const filter = `$filter=ItemCode eq '${itemCode}'`;
    const url = `${baseUrl}/odata4/ItemVersion?${filter}`;
    
    console.log(`[getItemVersion] URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[getItemVersion] Respuesta para ${itemCode}:`, data);
    
    // La respuesta tiene formato { value: [...] }
    if (data && data.value && Array.isArray(data.value) && data.value.length > 0) {
      return data.value[0]; // Retornar el primer resultado
    }
    
    return null;
  } catch (error) {
    console.error(`[getItemVersion] Error al consultar ItemVersion para ${itemCode}:`, error);
    
    // No fallar si no se puede obtener el ItemVersion, solo loguear el error
    // Esto permite que el stock se muestre aunque no se pueda obtener la cantidad por caja
    return null;
  }
};

/**
 * Crea un StockTransfer en el Service Layer
 * Usa el proxy genérico del backend: /api/sl/:method/:endpoint
 * @param {Object} stockTransferData - Datos del StockTransfer según estructura SAP B1
 * @returns {Promise<any>} Respuesta del Service Layer
 */
export const createStockTransfer = async (stockTransferData) => {
  try {
    console.log('[createStockTransfer] Creando StockTransfer:', JSON.stringify(stockTransferData, null, 2));
    
    // Usar el proxy genérico del backend: POST /api/sl/POST/StockTransfers
    // El backend reenvía el body directamente al Service Layer sin modificarlo
    const response = await apiClient.post('/api/sl/POST/StockTransfers', stockTransferData);
    
    console.log('[createStockTransfer] Respuesta recibida:', response.data);

    // El backend retorna { ok: true, data: {...} } en caso de éxito
    if (response.data && response.data.ok) {
      return response.data.data;
    }

    // Si el backend retorna ok: false, extraer el error correctamente
    const errorData = response.data?.error || response.data;
    let errorMessage = 'Error al crear el StockTransfer';
    
    // Extraer mensaje del formato SAP Service Layer: error.message.value
    if (errorData) {
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData.message) {
        if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        } else if (errorData.message.value) {
          errorMessage = errorData.message.value;
        } else {
          errorMessage = JSON.stringify(errorData.message);
        }
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    }
    
    const error = new Error(errorMessage);
    error.status = response.status || 400;
    error.data = errorData;
    throw error;
  } catch (error) {
    console.error('[createStockTransfer] Error:', error);
    console.error('[createStockTransfer] Error completo:', {
      message: error.message,
      status: error.status,
      data: error.data,
      response: error.response?.data,
    });
    
    // Si es error de red
    if (error.isNetworkError) {
      throw new Error('No se pudo conectar al backend. Verifica la conexión y que el backend esté accesible.');
    }

    // Si es error de sesión (401, 403)
    if (error.status === 401 || error.status === 403) {
      throw new Error('Sesión expirada o no hay sesión activa. Debe hacer login primero.');
    }

    // Si el error ya tiene un mensaje formateado, lanzarlo tal cual
    if (error.message && error.message !== 'Error al crear el StockTransfer') {
      throw error;
    }

    // Intentar extraer el mensaje del error.response.data
    if (error.response?.data) {
      const responseData = error.response.data;
      let errorMessage = 'Error al crear el StockTransfer';
      
      if (responseData.error) {
        const errorObj = responseData.error;
        if (errorObj.message?.value) {
          errorMessage = errorObj.message.value;
        } else if (errorObj.message) {
          errorMessage = typeof errorObj.message === 'string' ? errorObj.message : JSON.stringify(errorObj.message);
        } else if (typeof errorObj === 'string') {
          errorMessage = errorObj;
        } else {
          errorMessage = JSON.stringify(errorObj);
        }
      } else if (responseData.message) {
        if (responseData.message.value) {
          errorMessage = responseData.message.value;
        } else {
          errorMessage = typeof responseData.message === 'string' ? responseData.message : JSON.stringify(responseData.message);
        }
      }
      
      const formattedError = new Error(errorMessage);
      formattedError.status = error.status || error.response.status;
      formattedError.data = responseData;
      throw formattedError;
    }

    // Error del backend (ya viene formateado del interceptor)
    throw error;
  }
};


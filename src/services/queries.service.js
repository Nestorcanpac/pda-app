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
    const response = await apiClient.post(`/api/query/${queryName}`, parameters);

    // El backend retorna { ok: true, data: {...} } en caso de éxito
    if (response.data && response.data.ok) {
      return response.data.data;
    }

    // Si el backend retorna ok: false
    throw new Error(response.data?.error || `Error al ejecutar la query ${queryName}`);
  } catch (error) {
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
 * Ejecuta la query GetStockByBin como ejemplo
 * @param {string} binCode - Código del bin (ej: 'UBI-001')
 * @returns {Promise<any>} Datos del stock en el bin
 */
export const getStockByBin = async (binCode) => {
  return executeQuery('GetStockByBin', { binCode });
};


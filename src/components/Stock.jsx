import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getStockByBin, createStockTransfer, getItemVersion } from "../services/queries.service";
import { useScanner } from "../hooks/useScanner";
import MoveStock from "./MoveStock";
import "./Stock.css";

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Stock({ onBack, onLogout }) {
  const { session, refreshSession, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [binCode, setBinCode] = useState("");
  const [selectedLot, setSelectedLot] = useState(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [itemVersions, setItemVersions] = useState({}); // Cache de ItemVersions por ItemCode
  const [expandedDetails, setExpandedDetails] = useState(null); // Índice de la card con detalles expandidos

  // Escáner HID: captura el código escaneado y lo pone en el campo binCode
  useScanner((code) => {
    setBinCode(code);
    // Opcional: buscar automáticamente después de escanear
    // setTimeout(() => consultarStock(), 100);
  });

  const consultarStock = async () => {
    // Verificar sesión primero
    if (!isAuthenticated) {
      const hasSession = await refreshSession();
      if (!hasSession) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
        return;
      }
    }

    if (!binCode.trim()) {
      setError("Por favor, introduce un código de bin");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const binCodeValue = binCode.trim();
      
      console.log('[Stock] Consultando stock para bin:', binCodeValue);
      console.log('[Stock] Bin code value:', JSON.stringify(binCodeValue));
      
      // Usar el nuevo servicio que se comunica con el backend proxy
      const response = await getStockByBin(binCodeValue);
      
      console.log('[Stock] Respuesta recibida:', response);
      console.log('[Stock] Tipo de respuesta:', typeof response);
      console.log('[Stock] Es array?', Array.isArray(response));
      console.log('[Stock] Respuesta completa (JSON):', JSON.stringify(response, null, 2));

      // Procesar la respuesta
      // El backend retorna los datos directamente, pero puede venir en formato { value: [...] } o directamente como array
      let stockData = response;
      
      // Si viene en formato { value: [...] }, extraer el array
      if (response && response.value && Array.isArray(response.value)) {
        stockData = response;
      } else if (Array.isArray(response)) {
        // Si viene directamente como array, envolverlo en el formato esperado
        stockData = { value: response };
      }

      if (stockData && stockData.value && Array.isArray(stockData.value)) {
        if (stockData.value.length > 0) {
          setData(stockData);
          
          // Obtener ItemVersions para cada ItemCode único
          const uniqueItemCodes = [...new Set(stockData.value.map(item => item.ItemCode).filter(Boolean))];
          const versionsMap = {};
          
          // Hacer peticiones en paralelo para todos los ItemCodes
          const versionPromises = uniqueItemCodes.map(async (itemCode) => {
            try {
              const version = await getItemVersion(itemCode);
              if (version && version.UDF1) {
                versionsMap[itemCode] = version.UDF1;
              }
            } catch (err) {
              console.warn(`[Stock] No se pudo obtener ItemVersion para ${itemCode}:`, err);
              // No fallar si no se puede obtener el ItemVersion
            }
          });
          
          await Promise.all(versionPromises);
          setItemVersions(versionsMap);
        } else {
          setError("No se encontraron resultados para este bin");
          setData(null);
          setItemVersions({});
        }
      } else {
        setError("Respuesta inválida del servidor");
        setData(null);
        setItemVersions({});
      }
    } catch (err) {
      console.error('Error al consultar stock:', err);
      console.error('Error completo:', JSON.stringify(err, null, 2));
      
      // Extraer mensaje de error de forma robusta
      let errorMessage = "Error al consultar el stock";
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.error) {
          errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
        } else if (err.data) {
          if (typeof err.data === 'string') {
            errorMessage = err.data;
          } else if (err.data.error) {
            errorMessage = err.data.error;
          } else if (err.data.message) {
            errorMessage = err.data.message;
          } else {
            errorMessage = JSON.stringify(err.data);
          }
        } else if (err.response?.data) {
          const responseData = err.response.data;
          if (typeof responseData === 'string') {
            errorMessage = responseData;
          } else if (responseData.error) {
            errorMessage = responseData.error;
          } else if (responseData.message) {
            errorMessage = responseData.message;
          } else {
            errorMessage = JSON.stringify(responseData);
          }
        } else {
          errorMessage = JSON.stringify(err);
        }
      }
      
      // Mensajes de error más amigables
      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('no hay sesión activa') || errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (errorMessage.includes('No se pudo conectar al backend') || errorMessage.includes('ERR_NETWORK') || errorMessage.includes('CORS')) {
        errorMessage = "No se pudo conectar al backend. Verifica que esté corriendo.";
      } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        errorMessage = `Error en la petición: ${errorMessage}. Verifica el formato del bin code.`;
      }
      
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveBack = () => {
    setSelectedLot(null);
  };

  const handleMoveConfirm = async (moveData) => {
    try {
      setLoading(true);
      setError("");

      // Validar que las ubicaciones origen y destino sean diferentes
      if (moveData.BinAbsEntry === moveData.destinationBinAbsEntry) {
        setError("La ubicación origen y destino deben ser diferentes. Por favor, selecciona una ubicación destino distinta.");
        setLoading(false);
        return;
      }

      // Validar que tenemos todos los datos necesarios
      if (!moveData.BinAbsEntry) {
        setError("Error: No se encontró la ubicación origen. Por favor, vuelve a consultar el stock.");
        setLoading(false);
        return;
      }

      if (!moveData.destinationBinAbsEntry) {
        setError("Error: No se encontró la ubicación destino. Por favor, busca la ubicación destino nuevamente.");
        setLoading(false);
        return;
      }

      // Validar que tenemos el lote
      if (!moveData.Lote || (typeof moveData.Lote === 'string' && moveData.Lote.trim() === '')) {
        console.error('[Stock] Error: Lote no encontrado en moveData:', moveData);
        setError("Error: No se encontró el número de lote. Por favor, vuelve a consultar el stock.");
        setLoading(false);
        return;
      }

      console.log('[Stock] Datos del movimiento:', {
        moveData: moveData,
        origenBinAbsEntry: moveData.BinAbsEntry,
        destinoBinAbsEntry: moveData.destinationBinAbsEntry,
        origenBinCode: moveData.Ubicacion,
        destinoBinCode: moveData.destinationBin,
        lote: moveData.Lote,
        itemCode: moveData.ItemCode
      });

      // Validar que tenemos el lote
      const loteValue = moveData.Lote || moveData.DistNumber || moveData.BatchNumber;
      if (!loteValue || (typeof loteValue === 'string' && loteValue.trim() === '')) {
        console.error('[Stock] Error: Lote no encontrado en moveData:', {
          moveData: moveData,
          Lote: moveData.Lote,
          DistNumber: moveData.DistNumber,
          BatchNumber: moveData.BatchNumber
        });
        setError("Error: No se encontró el número de lote. Por favor, vuelve a consultar el stock.");
        setLoading(false);
        return;
      }

      // Construir el objeto StockTransfer según la estructura requerida de SAP B1 Service Layer
      const stockTransfer = {
        FromWarehouse: moveData.Almacen || moveData.WarehouseCode,
        ToWarehouse: moveData.destinationWhsCode,
        StockTransferLines: [
          {
            ItemCode: moveData.ItemCode,
            Quantity: moveData.quantityToMove,
            BatchNumbers: [
              {
                BatchNumber: (loteValue || '').toString().trim(),
                Quantity: moveData.quantityToMove
              }
            ],
            StockTransferLinesBinAllocations: [
              {
                BinAbsEntry: moveData.BinAbsEntry,
                Quantity: moveData.quantityToMove,
                BinActionType: 2, // batFromWarehouse
                SerialAndBatchNumbersBaseLine: 0
              },
              {
                BinAbsEntry: moveData.destinationBinAbsEntry,
                Quantity: moveData.quantityToMove,
                BinActionType: 1, // batToWarehouse
                SerialAndBatchNumbersBaseLine: 0
              }
            ]
          }
        ]
      };

      console.log('[Stock] Creando StockTransfer:', JSON.stringify(stockTransfer, null, 2));

      // Crear el StockTransfer
      const result = await createStockTransfer(stockTransfer);
      
      console.log('[Stock] StockTransfer creado exitosamente:', result);
      
      // Mostrar popup de éxito
      setSuccessMessage(`Movimiento realizado exitosamente. Se movieron ${moveData.quantityToMove.toLocaleString()} unidades.`);
      setShowSuccessPopup(true);
      
      // Volver a la pantalla anterior y recargar los datos
      setSelectedLot(null);
      
      // Recargar el stock para reflejar los cambios
      if (binCode.trim()) {
        await consultarStock();
      }
      
    } catch (err) {
      console.error('Error al crear StockTransfer:', err);
      let errorMessage = "Error al realizar el movimiento";
      
      if (err) {
        // Intentar extraer el mensaje de error de diferentes formas
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.response?.data) {
          // Error del backend con respuesta
          const responseData = err.response.data;
          if (typeof responseData === 'string') {
            errorMessage = responseData;
          } else if (responseData.error) {
            if (typeof responseData.error === 'string') {
              errorMessage = responseData.error;
            } else if (responseData.error.message) {
              errorMessage = responseData.error.message;
            } else if (responseData.error.message?.value) {
              // Formato SAP Service Layer
              errorMessage = responseData.error.message.value;
            } else {
              errorMessage = JSON.stringify(responseData.error);
            }
          } else if (responseData.message) {
            errorMessage = responseData.message;
          } else if (responseData.error?.message?.value) {
            // Formato SAP Service Layer anidado
            errorMessage = responseData.error.message.value;
          } else {
            errorMessage = JSON.stringify(responseData);
          }
        } else if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          } else {
            errorMessage = JSON.stringify(err.error);
          }
        } else if (err.data) {
          if (typeof err.data === 'string') {
            errorMessage = err.data;
          } else if (err.data.error) {
            errorMessage = typeof err.data.error === 'string' ? err.data.error : JSON.stringify(err.data.error);
          } else {
            errorMessage = JSON.stringify(err.data);
          }
        } else {
          // Si no se puede extraer, mostrar un mensaje genérico con el código de estado
          if (err.status) {
            errorMessage = `Error ${err.status}: ${err.message || 'Error desconocido'}`;
          } else {
            errorMessage = err.message || 'Error desconocido al realizar el movimiento';
          }
        }
      }
      
      // Mensajes de error más amigables
      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('no hay sesión activa') || errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (errorMessage.includes('No se pudo conectar al backend') || errorMessage.includes('ERR_NETWORK')) {
        errorMessage = "No se pudo conectar al backend. Verifica que esté corriendo.";
      }
      
      setError(errorMessage);
      // No cerrar la pantalla de movimiento si hay error, para que el usuario pueda corregir
    } finally {
      setLoading(false);
    }
  };

  // Si hay un lote seleccionado, mostrar la pantalla de movimiento
  if (selectedLot) {
    return (
      <MoveStock
        lotData={selectedLot}
        onBack={handleMoveBack}
        onConfirm={handleMoveConfirm}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="stock-fullscreen">
      <header className="stock-header">
        <button className="header-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="stock-title">Stock</span>
        <button className="header-logout" onClick={onLogout} aria-label="Cerrar sesión">
          <LogoutIcon />
        </button>
      </header>
      <main className="stock-main">
        <h2>Consulta de Stock por Bin Code</h2>
        
        <div className="stock-controls">
          <label htmlFor="bin-code-input">Bin Code:</label>
          <input
            id="bin-code-input"
            type="text"
            value={binCode}
            onChange={(e) => setBinCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                consultarStock();
              }
            }}
            placeholder="Ej: 19-RECUENTO..."
            disabled={loading}
            className="stock-input"
            autoFocus
          />
          
          <button 
            onClick={consultarStock} 
            disabled={loading || !binCode.trim()}
            className="stock-btn"
          >
            {loading ? "Buscando..." : "Buscar Stock"}
          </button>
        </div>

        {error && (
          <div className="stock-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <div className="stock-results">
            <h3>✅ Resultados:</h3>
            <div className="stock-info">
              <p><strong>Bin Code:</strong> {binCode}</p>
              {data.value && data.value.length > 0 && data.value[0].Almacen && (
                <p><strong>Almacén:</strong> {data.value[0].Almacen}</p>
              )}
              <p><strong>Items encontrados:</strong> {data.value ? data.value.length : 'N/A'}</p>
            </div>
            {data.value && data.value.length > 0 && (
              <div className="stock-cards-container">
                <h4>Lotes ({data.value.length}):</h4>
                <div className="stock-cards-grid">
                  {data.value.map((row, index) => {
                    const estado = row.Estado !== undefined ? parseInt(row.Estado) : 0;

                    let estadoTexto = '';
                    let estadoClass = '';
                    if (estado === 0) {
                      estadoTexto = 'Liberado';
                      estadoClass = 'stock-status-liberado';
                    } else if (estado === 1) {
                      estadoTexto = 'Denegado';
                      estadoClass = 'stock-status-denegado';
                    } else if (estado === 2) {
                      estadoTexto = 'Bloqueado';
                      estadoClass = 'stock-status-bloqueado';
                    }
                    
                    return (
                      <div key={index} className="stock-card">
                        <div className="stock-card-content">
                          <div className="stock-card-row">
                            <div className="stock-card-field">
                              <span className="stock-card-label">Item Code:</span>
                              <span className="stock-card-value">{row.ItemCode || '-'}</span>
                            </div>
                            <div className="stock-card-field">
                              <span className="stock-card-label">Lote:</span>
                              <span className="stock-card-value">{row.Lote || '-'}</span>
                            </div>
                          </div>
                          <div className="stock-card-field">
                            <span className="stock-card-label">Cajas:</span>
                            <span className="stock-card-value stock-card-quantity">
                              {(() => {
                                const cantidad = row.Cantidad !== undefined ? parseFloat(row.Cantidad) : 0;
                                const udf1 = itemVersions[row.ItemCode] ? parseFloat(itemVersions[row.ItemCode]) : null;
                                
                                if (udf1 && udf1 > 0 && cantidad > 0) {
                                  const cajas = cantidad / udf1;
                                  // Mostrar con máximo 2 decimales, sin decimales si es entero
                                  return cajas % 1 === 0 ? cajas.toLocaleString('es-ES') : cajas.toFixed(2).replace(/\.?0+$/, '');
                                }
                                return '-';
                              })()}
                            </span>
                          </div>
                          {expandedDetails === index && (
                            <div className="stock-card-details">
                              <div className="stock-card-detail-row">
                                <span className="stock-card-detail-label">Cantidad Total:</span>
                                <span className="stock-card-detail-value">
                                  {row.Cantidad !== undefined ? row.Cantidad.toLocaleString('es-ES') : '-'}
                                </span>
                              </div>
                              {itemVersions[row.ItemCode] && (
                                <div className="stock-card-detail-row">
                                  <span className="stock-card-detail-label">Cant. x Caja:</span>
                                  <span className="stock-card-detail-value">
                                    {itemVersions[row.ItemCode]}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {estadoTexto && (
                            <div className="stock-card-status">
                              <span className={`stock-status-badge ${estadoClass}`}>
                                {estadoTexto}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="stock-card-actions">
                          <button 
                            className="stock-details-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDetails(expandedDetails === index ? null : index);
                            }}
                          >
                            {expandedDetails === index ? 'Ocultar detalles' : 'Más detalles'}
                          </button>
                          <button 
                            className="stock-move-btn"
                            onClick={() => {
                              setSelectedLot(row);
                            }}
                          >
                            Mover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Popup de éxito */}
      {showSuccessPopup && (
        <div className="stock-success-popup-overlay" onClick={() => setShowSuccessPopup(false)}>
          <div className="stock-success-popup" onClick={(e) => e.stopPropagation()}>
            <div className="stock-success-popup-icon">✅</div>
            <h3>¡Éxito!</h3>
            <p>{successMessage}</p>
            <button 
              className="stock-success-popup-btn"
              onClick={() => setShowSuccessPopup(false)}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


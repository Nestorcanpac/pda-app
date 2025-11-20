import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getByLote, createStockTransfer, getItemVersion } from "../services/queries.service";
import { useScanner } from "../hooks/useScanner";
import MoveStock from "./MoveStock";
import "./TrasladoRapido.css";

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

export default function TrasladoRapido({ onBack, onLogout }) {
  const { refreshSession, isAuthenticated, employeeName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [lote, setLote] = useState("");
  const [selectedLot, setSelectedLot] = useState(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [itemVersions, setItemVersions] = useState({}); // Cache de ItemVersions por ItemCode

  // Escáner HID: captura el código escaneado y lo pone en el campo lote
  useScanner((code) => {
    setLote(code);
  });

  const buscarLote = async () => {
    // Verificar sesión primero
    if (!isAuthenticated) {
      const hasSession = await refreshSession();
      if (!hasSession) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
        return;
      }
    }

    if (!lote.trim()) {
      setError("Por favor, introduce un número de lote");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const loteValue = lote.trim();
      
      console.log('[TrasladoRapido] Consultando lote:', loteValue);
      
      // Usar el servicio que se comunica con el backend proxy
      const response = await getByLote(loteValue);
      
      console.log('[TrasladoRapido] Respuesta recibida:', response);

      // Procesar la respuesta
      let lotData = response;
      
      if (response && response.value && Array.isArray(response.value)) {
        lotData = response;
      } else if (Array.isArray(response)) {
        lotData = { value: response };
      }

      if (lotData && lotData.value && Array.isArray(lotData.value)) {
        if (lotData.value.length > 0) {
          setData(lotData);
          
          // Obtener ItemVersions para cada ItemCode único
          const uniqueItemCodes = [...new Set(lotData.value.map(item => item.ItemCode).filter(Boolean))];
          const versionsMap = {};
          
          // Hacer peticiones en paralelo para todos los ItemCodes
          const versionPromises = uniqueItemCodes.map(async (itemCode) => {
            try {
              const version = await getItemVersion(itemCode);
              if (version && version.UDF1) {
                versionsMap[itemCode] = version.UDF1;
              }
            } catch (err) {
              console.warn(`[TrasladoRapido] No se pudo obtener ItemVersion para ${itemCode}:`, err);
            }
          });
          
          await Promise.all(versionPromises);
          setItemVersions(versionsMap);
        } else {
          setError("No se encontraron resultados para este lote");
          setData(null);
          setItemVersions({});
        }
      } else {
        setError("Respuesta inválida del servidor");
        setData(null);
        setItemVersions({});
      }
    } catch (err) {
      console.error('Error al consultar lote:', err);
      let errorMessage = "Error al consultar el lote";
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.response?.data) {
          const responseData = err.response.data;
          if (typeof responseData === 'string') {
            errorMessage = responseData;
          } else if (responseData.error) {
            errorMessage = typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error);
          } else {
            errorMessage = JSON.stringify(responseData);
          }
        }
      }

      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('no hay sesión activa') || errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (errorMessage.includes('No se pudo conectar al backend') || errorMessage.includes('ERR_NETWORK')) {
        errorMessage = "No se pudo conectar al backend. Verifica que esté corriendo.";
      }

      setError(errorMessage);
      setData(null);
      setItemVersions({});
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (lotData) => {
    try {
      console.log('[TrasladoRapido] Iniciando movimiento:', lotData);
      
      // Asegurar que tenemos el nombre del empleado
      const userName = employeeName && employeeName.trim() !== '' ? employeeName.trim() : '';
      if (!userName) {
        console.warn('[TrasladoRapido] Advertencia: No se encontró el nombre del empleado. El campo U_IFGWHS_NOMUSR se enviará vacío.');
      }
      
      const stockTransferData = {
        FromWarehouse: lotData.Almacen,
        ToWarehouse: lotData.destinationWhsCode,
        U_IFGWHS_NOMUSR: userName, // Siempre incluir el campo, incluso si está vacío
        StockTransferLines: [
          {
            ItemCode: lotData.ItemCode,
            Quantity: lotData.quantityToMove,
            BatchNumbers: [
              {
                BatchNumber: lotData.Lote,
                Quantity: lotData.quantityToMove
              }
            ],
            StockTransferLinesBinAllocations: [
              {
                BinAbsEntry: lotData.BinAbsEntry,
                Quantity: lotData.quantityToMove,
                BinActionType: 2, // batFromWarehouse
                SerialAndBatchNumbersBaseLine: 0
              },
              {
                BinAbsEntry: lotData.destinationBinAbsEntry,
                Quantity: lotData.quantityToMove,
                BinActionType: 1, // batToWarehouse
                SerialAndBatchNumbersBaseLine: 0
              }
            ]
          }
        ]
      };

      console.log('[TrasladoRapido] Datos del StockTransfer:', JSON.stringify(stockTransferData, null, 2));
      console.log('[TrasladoRapido] Campo U_IFGWHS_NOMUSR:', stockTransferData.U_IFGWHS_NOMUSR || 'NO DEFINIDO');

      await createStockTransfer(stockTransferData);
      
      setShowSuccessPopup(true);
      setSuccessMessage(`Movimiento realizado correctamente: ${lotData.quantityToMove.toLocaleString('es-ES')} unidades del lote ${lotData.Lote} desde ${lotData.Ubicacion} hacia ${lotData.destinationBin}`);
      
      // Recargar los datos después de un movimiento exitoso
      setTimeout(() => {
        buscarLote();
      }, 1500);
    } catch (err) {
      console.error('Error al realizar el movimiento:', err);
      let errorMessage = "Error al realizar el movimiento";
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.response?.data) {
          const responseData = err.response.data;
          if (typeof responseData === 'string') {
            errorMessage = responseData;
          } else if (responseData.error) {
            if (typeof responseData.error === 'string') {
              errorMessage = responseData.error;
            } else if (responseData.error.message) {
              errorMessage = responseData.error.message;
            } else if (responseData.error.message?.value) {
              errorMessage = responseData.error.message.value;
            } else {
              errorMessage = JSON.stringify(responseData.error);
            }
          } else if (responseData.message) {
            errorMessage = responseData.message;
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
          if (err.status) {
            errorMessage = `Error ${err.status}: ${err.message || 'Error desconocido'}`;
          } else {
            errorMessage = err.message || 'Error desconocido al realizar el movimiento';
          }
        }
      }

      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('no hay sesión activa') || errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (errorMessage.includes('No se pudo conectar al backend') || errorMessage.includes('ERR_NETWORK')) {
        errorMessage = "No se pudo conectar al backend. Verifica que esté corriendo.";
      }

      setError(errorMessage);
    }
  };

  if (selectedLot) {
    return (
      <MoveStock
        lotData={selectedLot}
        onBack={() => setSelectedLot(null)}
        onConfirm={handleMove}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="traslado-fullscreen">
      <header className="traslado-header">
        <button className="header-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="traslado-title">Traslado rápido</span>
        <button className="header-logout" aria-label="Cerrar sesión" onClick={onLogout}>
          <LogoutIcon />
        </button>
      </header>
      <main className="traslado-main">
        <div className="traslado-controls">
          <h2>Buscar por Lote</h2>
          <div className="traslado-input-group">
            <input
              type="text"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !loading) {
                  buscarLote();
                }
              }}
              placeholder="Número de lote"
              disabled={loading}
              className="traslado-input"
              autoFocus
            />
            <button
              onClick={buscarLote}
              disabled={loading || !lote.trim()}
              className="traslado-btn"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="traslado-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <div className="traslado-results">
            <div className="traslado-summary">
              <p><strong>Items encontrados:</strong> {data.value ? data.value.length : 'N/A'}</p>
            </div>
            {data.value && data.value.length > 0 && (
              <div className="traslado-cards-container">
                <h4>Lotes ({data.value.length}):</h4>
                <div className="traslado-cards-grid">
                  {data.value.map((row, index) => {
                    const cantidad = row.Cantidad !== undefined ? parseFloat(row.Cantidad) : 0;
                    const udf1 = itemVersions[row.ItemCode] ? parseFloat(itemVersions[row.ItemCode]) : null;
                    const cajas = udf1 && udf1 > 0 && cantidad > 0 
                      ? (cantidad / udf1) 
                      : null;
                    
                    return (
                      <div key={index} className="traslado-card">
                        <div className="traslado-card-content">
                          <div className="traslado-card-row">
                            <div className="traslado-card-field">
                              <span className="traslado-card-label">Item Code:</span>
                              <span className="traslado-card-value">{row.ItemCode || '-'}</span>
                            </div>
                            <div className="traslado-card-field">
                              <span className="traslado-card-label">Lote:</span>
                              <span className="traslado-card-value">{row.Lote || '-'}</span>
                            </div>
                          </div>
                          <div className="traslado-card-field">
                            <span className="traslado-card-label">Cajas:</span>
                            <span className="traslado-card-value traslado-card-quantity">
                              {cajas !== null 
                                ? (cajas % 1 === 0 ? cajas.toLocaleString('es-ES') : cajas.toFixed(2).replace(/\.?0+$/, ''))
                                : '-'
                              }
                            </span>
                          </div>
                          <div className="traslado-card-row">
                            <div className="traslado-card-field">
                              <span className="traslado-card-label">Ubicación:</span>
                              <span className="traslado-card-value">{row.Ubicacion || '-'}</span>
                            </div>
                            <div className="traslado-card-field">
                              <span className="traslado-card-label">Almacén:</span>
                              <span className="traslado-card-value">{row.Almacen || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          className="traslado-move-btn"
                          onClick={() => {
                            setSelectedLot(row);
                          }}
                        >
                          Mover
                        </button>
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
        <div className="traslado-success-popup-overlay" onClick={() => setShowSuccessPopup(false)}>
          <div className="traslado-success-popup" onClick={(e) => e.stopPropagation()}>
            <div className="traslado-success-icon">✓</div>
            <h3>Movimiento realizado</h3>
            <p>{successMessage}</p>
            <button onClick={() => setShowSuccessPopup(false)} className="traslado-success-btn">
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


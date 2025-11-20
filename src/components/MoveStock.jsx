import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getBinCode, getItemVersion } from "../services/queries.service";
import { useScanner } from "../hooks/useScanner";
import "./MoveStock.css";

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function MoveStock({ lotData, onBack, onConfirm, loading: externalLoading = false, error: externalError = "" }) {
  const { refreshSession, isAuthenticated } = useAuth();
  const [moveType, setMoveType] = useState(null); // 'cajas' | 'palet' | null
  const [numberOfBoxes, setNumberOfBoxes] = useState("");
  const [paletQuantity, setPaletQuantity] = useState(""); // Cantidad escaneada para palet
  const [destinationBin, setDestinationBin] = useState("");
  const [searchingBin, setSearchingBin] = useState(false);
  const [error, setError] = useState("");
  const [itemVersion, setItemVersion] = useState(null);
  const [loadingItemVersion, setLoadingItemVersion] = useState(false);
  
  const loading = externalLoading;

  const maxQuantity = lotData?.Cantidad || 0;
  const cantidadPorCaja = itemVersion?.UDF1 ? parseFloat(itemVersion.UDF1) : null;
  const maxCajas = cantidadPorCaja && cantidadPorCaja > 0 ? Math.floor(maxQuantity / cantidadPorCaja) : 0;
  
  // Verificar si el lote está bloqueado o denegado
  const estado = lotData?.Estado !== undefined ? parseInt(lotData.Estado) : 0;
  const isBlockedOrDenied = estado === 1 || estado === 2; // 1 = Denegado, 2 = Bloqueado
  const almacenesRestringidos = ['18', '21'];

  // Obtener ItemVersion al cargar el componente
  useEffect(() => {
    const fetchItemVersion = async () => {
      if (!lotData?.ItemCode) return;
      
      setLoadingItemVersion(true);
      try {
        const version = await getItemVersion(lotData.ItemCode);
        if (version) {
          setItemVersion(version);
        }
      } catch (err) {
        console.warn('[MoveStock] No se pudo obtener ItemVersion:', err);
      } finally {
        setLoadingItemVersion(false);
      }
    };

    fetchItemVersion();
  }, [lotData?.ItemCode]);

  // Escáner HID: captura el código escaneado
  useScanner((code) => {
    // Si está en modo palet y no hay cantidad escaneada, poner el código en paletQuantity
    if (moveType === 'palet' && !paletQuantity) {
      setPaletQuantity(code);
    } else {
      // Si hay cantidad de palet o está en modo cajas, poner el código en destinationBin
      setDestinationBin(code);
    }
  });

  const handleBoxesChange = (e) => {
    const value = e.target.value;
    if (value === "" || (value >= 0 && value <= maxCajas)) {
      setNumberOfBoxes(value);
    }
  };


  const handleConfirm = async () => {
    // Validar que se haya seleccionado un tipo de movimiento
    if (!moveType) {
      setError("Por favor, selecciona si quieres mover por cajas o por palet");
      return;
    }

    // Validar cantidad según el tipo
    let quantityToMove = 0;
    if (moveType === 'cajas') {
      if (!numberOfBoxes || parseFloat(numberOfBoxes) <= 0) {
        setError("Por favor, introduce un número válido de cajas");
        return;
      }
      if (!cantidadPorCaja || cantidadPorCaja <= 0) {
        setError("No se pudo obtener la cantidad por caja para este item");
        return;
      }
      quantityToMove = parseFloat(numberOfBoxes) * cantidadPorCaja;
      if (quantityToMove > maxQuantity) {
        setError(`La cantidad calculada (${quantityToMove.toLocaleString()}) excede la cantidad disponible (${maxQuantity.toLocaleString()})`);
        return;
      }
    } else if (moveType === 'palet') {
      if (!paletQuantity || parseFloat(paletQuantity) <= 0) {
        setError("Por favor, escanea el código de barras del palet o introduce la cantidad");
        return;
      }
      quantityToMove = parseFloat(paletQuantity);
      if (quantityToMove > maxQuantity) {
        setError(`La cantidad escaneada (${quantityToMove.toLocaleString()}) excede la cantidad disponible (${maxQuantity.toLocaleString()})`);
        return;
      }
    }

    // Validar que haya ubicación destino introducida
    if (!destinationBin.trim()) {
      setError("Por favor, introduce un código de ubicación destino");
      return;
    }

    // Verificar sesión primero
    if (!isAuthenticated) {
      const hasSession = await refreshSession();
      if (!hasSession) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
        return;
      }
    }

    setError("");
    setSearchingBin(true);

    try {
      // Primero buscar la ubicación destino
      const binCodeValue = destinationBin.trim();
      console.log('[MoveStock] Consultando ubicación destino:', binCodeValue);

      const response = await getBinCode(binCodeValue);
      console.log('[MoveStock] Respuesta recibida:', response);

      // Procesar la respuesta
      let binData = response;
      if (response && response.value && Array.isArray(response.value)) {
        binData = response;
      } else if (Array.isArray(response)) {
        binData = { value: response };
      }

      if (!binData || !binData.value || !Array.isArray(binData.value) || binData.value.length === 0) {
        setError("No se encontró la ubicación destino");
        setSearchingBin(false);
        return;
      }

      const binDataFound = binData.value[0];
      
      // Validar que no se pueda mover a almacenes restringidos si el lote está bloqueado/denegado
      if (isBlockedOrDenied && binDataFound.WhsCode && almacenesRestringidos.includes(binDataFound.WhsCode)) {
        const estadoTexto = estado === 1 ? 'denegado' : 'bloqueado';
        setError(`No se puede realizar el movimiento. El lote está ${estadoTexto} y no se permiten movimientos al almacén ${binDataFound.WhsCode} (almacén de producción/nave de consumo).`);
        setSearchingBin(false);
        return;
      }

      // Validar que las ubicaciones sean diferentes antes de confirmar
      if (lotData.BinAbsEntry === binDataFound.AbsEntry) {
        setError("La ubicación origen y destino son iguales. Por favor, selecciona una ubicación destino diferente.");
        setSearchingBin(false);
        return;
      }
      
      console.log('[MoveStock] Confirmando movimiento con datos:', {
        lotData: lotData,
        origenBinAbsEntry: lotData.BinAbsEntry,
        destinoBinAbsEntry: binDataFound.AbsEntry,
        origenBinCode: lotData.Ubicacion,
        destinoBinCode: binDataFound.BinCode
      });
      
      if (onConfirm) {
        onConfirm({
          ...lotData,
          quantityToMove,
          destinationBin: binDataFound.BinCode,
          destinationBinAbsEntry: binDataFound.AbsEntry,
          destinationWhsCode: binDataFound.WhsCode
        });
      }
    } catch (err) {
      console.error('Error al consultar ubicación:', err);
      let errorMessage = "Error al consultar la ubicación destino";
      
      if (err) {
        // Intentar extraer el mensaje de error de diferentes formas
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
            errorMessage = err.message || 'Error desconocido al consultar la ubicación';
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
    } finally {
      setSearchingBin(false);
    }
  };

  return (
    <div className="move-stock-fullscreen">
      <header className="move-stock-header">
        <button className="header-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="move-stock-title">Mover Stock</span>
        <div style={{ width: "44px" }}></div>
      </header>
      <main className="move-stock-main">
        {isBlockedOrDenied && (
          <div className="move-stock-warning">
            ⚠️ <strong>Advertencia:</strong> Este lote está {estado === 1 ? 'denegado' : 'bloqueado'}. No se pueden realizar movimientos a los almacenes 18 (producción) y 21 (nave de consumo).
          </div>
        )}
        <div className="move-stock-info-card">
          <h3>Información del Lote</h3>
          <div className="move-stock-info-compact">
            <div className="move-stock-info-item">
              <span className="move-stock-info-label">Item Code:</span>
              <span className="move-stock-info-value">{lotData?.ItemCode || '-'}</span>
            </div>
            <div className="move-stock-info-item">
              <span className="move-stock-info-label">Lote:</span>
              <span className="move-stock-info-value">{lotData?.Lote || '-'}</span>
            </div>
            <div className="move-stock-info-item">
              <span className="move-stock-info-label">Cantidad:</span>
              <span className="move-stock-info-value move-stock-quantity">{maxQuantity.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="move-stock-section">
          <h3>Tipo de Movimiento</h3>
          <div className="move-stock-type-buttons">
            <button
              type="button"
              className={`move-stock-type-btn ${moveType === 'cajas' ? 'active' : ''}`}
              onClick={() => {
                setMoveType('cajas');
                setNumberOfBoxes("");
                setError("");
              }}
              disabled={loading || loadingItemVersion}
            >
              📦 Cajas
            </button>
            <button
              type="button"
              className={`move-stock-type-btn ${moveType === 'palet' ? 'active' : ''}`}
              onClick={() => {
                setMoveType('palet');
                setNumberOfBoxes("");
                setPaletQuantity("");
                setError("");
              }}
              disabled={loading || loadingItemVersion}
            >
              🏭 Palet
            </button>
          </div>
          {moveType === 'cajas' && (
            <div className="move-stock-boxes-input">
              <label className="move-stock-boxes-label">
                Número de Cajas {cantidadPorCaja && `(máx. ${maxCajas})`}
              </label>
              <input
                type="number"
                min="0"
                max={maxCajas}
                step="1"
                value={numberOfBoxes}
                onChange={handleBoxesChange}
                placeholder="Cantidad de cajas"
                disabled={loading || loadingItemVersion || !cantidadPorCaja}
                className="move-stock-input"
                autoFocus
              />
              {numberOfBoxes && cantidadPorCaja && parseFloat(numberOfBoxes) > 0 && (
                <div className="move-stock-calculated-quantity">
                  Cantidad total: <strong>{(parseFloat(numberOfBoxes) * cantidadPorCaja).toLocaleString('es-ES')}</strong> unidades
                </div>
              )}
              {loadingItemVersion && (
                <div className="move-stock-loading-info">Cargando información de cajas...</div>
              )}
              {!loadingItemVersion && !cantidadPorCaja && (
                <div className="move-stock-error-info">No se pudo obtener la cantidad por caja</div>
              )}
            </div>
          )}
          {moveType === 'palet' && (
            <div className="move-stock-palet-input">
              <label className="move-stock-boxes-label">
                Escanear código de barras del palet
              </label>
              <input
                type="text"
                value={paletQuantity}
                onChange={(e) => setPaletQuantity(e.target.value)}
                placeholder="Escanea el código de barras o introduce la cantidad"
                disabled={loading || searchingBin}
                className="move-stock-input"
                autoFocus
              />
              {paletQuantity && parseFloat(paletQuantity) > 0 && (
                <div className="move-stock-calculated-quantity">
                  Cantidad a mover: <strong>{parseFloat(paletQuantity).toLocaleString('es-ES')}</strong> unidades
                </div>
              )}
            </div>
          )}
        </div>

        {moveType && ((moveType === 'palet' && paletQuantity && parseFloat(paletQuantity) > 0) || (moveType === 'cajas' && numberOfBoxes && parseFloat(numberOfBoxes) > 0)) && (
          <div className="move-stock-section">
            <h3>Ubicación Destino</h3>
            <div className="move-stock-controls">
              <input
                type="text"
                value={destinationBin}
                onChange={(e) => setDestinationBin(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !searchingBin && !loading) {
                    handleConfirm();
                  }
                }}
                placeholder="Código de ubicación destino"
                disabled={searchingBin || loading}
                className="move-stock-input"
                autoFocus
              />
            </div>
          </div>
        )}

        {(error || externalError) && (
          <div className="move-stock-error">
            <strong>Error:</strong> {error || externalError}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || searchingBin || !destinationBin.trim() || !moveType || (moveType === 'cajas' && (!numberOfBoxes || parseFloat(numberOfBoxes) <= 0)) || (moveType === 'palet' && (!paletQuantity || parseFloat(paletQuantity) <= 0))}
          className="move-stock-confirm-btn"
        >
          {loading || searchingBin ? "Procesando..." : "Confirmar Movimiento"}
        </button>
      </main>
    </div>
  );
}


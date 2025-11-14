import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getStockByBin } from "../services/queries.service";
import { useScanner } from "../hooks/useScanner";
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
      
      console.log('Consultando stock para bin:', binCodeValue);
      
      // Usar el nuevo servicio que se comunica con el backend proxy
      const response = await getStockByBin(binCodeValue);

      console.log('Respuesta de GetStockByBin:', response);

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
        } else {
          setError("No se encontraron resultados para este bin");
          setData(null);
        }
      } else {
        setError("Respuesta inválida del servidor");
        setData(null);
      }
    } catch (err) {
      console.error('Error al consultar stock:', err);
      
      // Manejar errores específicos
      let errorMessage = err.message || "Error al consultar el stock";
      
      if (errorMessage.includes('Sesión expirada') || errorMessage.includes('no hay sesión activa')) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (errorMessage.includes('No se pudo conectar al backend')) {
        errorMessage = "No se pudo conectar al backend. Verifica que esté corriendo.";
      }
      
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-fullscreen">
      <header className="stock-header">
        <button className="header-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="stock-title">Stock por Bin</span>
        <button className="header-logout" onClick={onLogout} aria-label="Cerrar sesión">
          <LogoutIcon />
        </button>
      </header>
      <main className="stock-main" style={{paddingTop: 66}}>
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
              <p><strong>Bin Code buscado:</strong> {binCode}</p>
              <p><strong>Items encontrados:</strong> {data.value ? data.value.length : 'N/A'}</p>
            </div>
            {data.value && data.value.length > 0 && (
              <div className="stock-table-container">
                <h4>Stock en Bin ({data.value.length} items):</h4>
                <div className="stock-table-wrapper">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Bin Code</th>
                        <th>Item Code</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.value.map((row, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{row.BinCode || '-'}</td>
                          <td>{row.ItemCode || '-'}</td>
                          <td>{row.OnHandQty !== undefined ? row.OnHandQty.toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <details className="stock-details">
              <summary>Ver todos los datos (JSON completo)</summary>
              <div className="stock-data">
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}


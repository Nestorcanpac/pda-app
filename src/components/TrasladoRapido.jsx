import React from "react";
import "./TrasladoRapido.css";
import { useScanner } from "../hooks/useScanner";
import { useAuth } from "../context/AuthContext";
import { sapRequest } from "../services/sapService";

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
  const { session } = useAuth();
  const [lote, setLote] = React.useState("");
  const [filas, setFilas] = React.useState(null); // null: sin buscar, false: no encontrado, []: resultados
  const [desc, setDesc] = React.useState("");
  const [filaSel, setFilaSel] = React.useState(null);
  const [ubicacionDestino, setUbicacionDestino] = React.useState("");
  const [almacenDestino, setAlmacenDestino] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [scanMode, setScanMode] = React.useState(false); // indica que el usuario pidió escanear
  const [scanTarget, setScanTarget] = React.useState(null); // 'lote' | 'ubicacion' | 'cantidad' | null
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Busca lote: hace POST a SQLQueries
  const buscarLote = React.useCallback(async () => {
    if (!lote.trim()) {
      setError("Por favor, introduce un número de lote");
      return;
    }

    if (!session?.sessionId) {
      setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    setError("");
    setDesc("");
    setFilas(null);
    setFilaSel(null);
    setUbicacionDestino("");
    setCantidad("");
    setAlmacenDestino("");

    try {
      const loteValue = lote.trim();
      const requestBody = {
        ParamList: `lotenum='${loteValue}'`
      };
      
      console.log('Body que se envía:', JSON.stringify(requestBody));
      console.log('Lote value:', loteValue);
      
      const response = await sapRequest("/SQLQueries('GetLoteEsp2')/List", session.sessionId, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('Respuesta de SQLQueries:', response);

      // Procesar la respuesta según la estructura que devuelva la API
      // La respuesta tiene: { odata.metadata, SqlText, value: [...] }
      if (response && response.value && Array.isArray(response.value)) {
        if (response.value.length > 0) {
          // Mapear los resultados a la estructura esperada por la tabla
          const filasMapeadas = response.value.map((item, idx) => ({
            id: idx + 1,
            lote: loteValue,
            almacen: item.WarehouseCode || item.Warehouse || "",
            ubicacion: item.Location || "",
            cantidad: item.Quantity || item.OnHandQty || 0,
            status: item.Status === "0" ? "DISPONIBLE" : item.Status === "1" ? "BLOQUEADO" : item.Status || "DESCONOCIDO",
            itemCode: item.ItemCode || ""
          }));
          
          setFilas(filasMapeadas);
          // Si hay ItemCode, usarlo como descripción
          if (response.value[0].ItemCode) {
            setDesc(response.value[0].ItemCode);
          } else {
            setDesc("Lote encontrado");
          }
        } else {
          setFilas(false);
          setDesc("");
        }
      } else {
        setFilas(false);
        setDesc("");
      }
    } catch (err) {
      console.error('Error al buscar lote:', err);
      setError(err.message || "Error al buscar el lote");
      setFilas(false);
      setDesc("");
    } finally {
      setLoading(false);
    }
  }, [lote, session]);

  // Escáner HID: usar destino explícito si scanTarget está definido; de lo contrario, lógica por defecto
  useScanner((code) => {
    if (scanTarget === 'lote') {
      setLote(code);
      setScanMode(false);
      setScanTarget(null);
      setTimeout(() => buscarLote(), 0);
      return;
    }
    if (scanTarget === 'ubicacion') {
      setUbicacionDestino(code);
      setAlmacenDestino(code ? "Almacén 2" : "");
      setScanMode(false);
      setScanTarget(null);
      return;
    }
    if (scanTarget === 'cantidad') {
      const num = String(code).replace(/[^0-9.,]/g, '').replace(',', '.');
      setCantidad(num);
      setScanMode(false);
      setScanTarget(null);
      return;
    }

    // Sin target explícito: por defecto, Lote si aún no hay resultados; si ya hay, Ubicación destino
    if (!Array.isArray(filas)) {
      setLote(code);
      setScanMode(false);
      setTimeout(() => buscarLote(), 0);
    } else {
      setUbicacionDestino(code);
      setAlmacenDestino(code ? "Almacén 2" : "");
      setScanMode(false);
    }
  });

  // Cambio ubicación destino: almacén destino es "Almacén 2" si está relleno, sino vacío
  const handleUbicDestChange = (e) => {
    const value = e.target.value;
    setUbicacionDestino(value);
    setAlmacenDestino(value ? "Almacén 2" : "");
  };

  const btnDisabled = filaSel === null || !ubicacionDestino.trim() || !cantidad.trim() || Number(cantidad) <= 0;

  return (
    <div className="traslado-container">
      <header className="traslado-header">
        <button className="header-back" onClick={onBack} title="Atrás">&#8592;</button>
        <span className="traslado-title">Traslado rápido</span>
        <button className="header-logout" aria-label="Cerrar sesión" onClick={onLogout}><LogoutIcon /></button>
      </header>
      <main className="traslado-body">
        {/* Buscador de lote */}
        <div className="campo-group">
          <label htmlFor="articulo" className="campo-label">Lote</label>
          <div className="campo-con-boton">
            <input id="articulo" type="text" className="campo-input" placeholder="" autoComplete="off" value={lote} onChange={e => setLote(e.target.value)} readOnly={loading} onKeyPress={e => { if (e.key === 'Enter' && !loading) buscarLote(); }}/>
            <button type="button" className="boton-scan" title="Escanear lote" onClick={() => { setScanMode(true); setScanTarget('lote'); setFilas(null); setDesc(''); setFilaSel(null); setUbicacionDestino(''); setCantidad(''); setAlmacenDestino(''); setError(''); }} disabled={loading}>
              <span role="img" aria-label="Escanear">📷</span>
            </button>
            <button type="button" className="boton-lupa" title="Buscar" onClick={buscarLote} disabled={loading || !lote.trim()}><span role="img" aria-label="Buscar">🔍</span></button>
            <button type="button" className="boton-check" title="Check y empezar" onClick={buscarLote} disabled={loading || !lote.trim()} style={{marginLeft: '4px', padding: '8px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: loading || !lote.trim() ? 'not-allowed' : 'pointer'}}>
              ✓
            </button>
          </div>
          {scanMode && scanTarget === 'lote' && <div className="scan-hint">Escanea el lote con el gatillo…</div>}
          {error && <div className="error-message" style={{color: '#c33', marginTop: '8px', fontSize: '0.9rem'}}>{error}</div>}
          {loading && <div className="loading-message" style={{color: '#666', marginTop: '8px', fontSize: '0.9rem'}}>Buscando lote...</div>}
        </div>
        {/* Panel azul descripción */}
        {desc && (
          <div className="descripcion-panel"><span role="img" aria-label="info" className="desc-ico">📦</span> {desc}</div>
        )}
        {/* Tabla de resultados */}
        {Array.isArray(filas) && filas.length > 0 && (
          <div className="tabla-palets-scroll">
            <table className="tabla-palets">
              <thead>
                <tr>
                  <th>Lote</th><th>Almacén</th><th>Ubicación</th><th>Cantidad</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, idx) => (
                  <tr
                    key={fila.id}
                    className={"tp-row" + (filaSel === idx ? " tp-row-sel" : "")}
                    onClick={() => {
                      setFilaSel(idx);
                      setUbicacionDestino("");
                      setAlmacenDestino("");
                      setCantidad("");
                    }}
                  >
                    <td>{fila.lote}</td>
                    <td>{fila.almacen}</td>
                    <td>{fila.ubicacion}</td>
                    <td>{fila.cantidad}</td>
                    <td>{fila.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Total */}
        {Array.isArray(filas) && filas.length > 0 && (
          <div className="total-linea">{filas.length} Total</div>
        )}
        {/* Si no hay resultados */}
        {filas === false && (
          <div className="lista-elementos-vacia">No hay elementos</div>
        )}
        {/* Formulario destino solo al seleccionar fila */}
        {Array.isArray(filas) && filas.length > 0 && filaSel !== null && (
          <div className="seccion-sub">
            <span className="seccion-titulo">Destino</span>
            <div className="campo-group">
              <label htmlFor="ubicacion-destino" className="campo-label">Ubicación destino</label>
              <div className="campo-con-boton">
                <input id="ubicacion-destino" type="text" className="campo-input" placeholder="" autoComplete="off" value={ubicacionDestino} onChange={handleUbicDestChange} />
                <button type="button" className="boton-scan" title="Escanear ubicación" onClick={() => { setScanMode(true); setScanTarget('ubicacion'); }}>
                  <span role="img" aria-label="Escanear">📷</span>
                </button>
                <button type="button" className="boton-lupa" title="Buscar"><span role="img" aria-label="Buscar">🔍</span></button>
              </div>
              {scanMode && scanTarget === 'ubicacion' && <div className="scan-hint">Escanea la ubicación destino…</div>}
            </div>
            <div className="campo-group">
              <label htmlFor="cantidad" className="campo-label">Cantidad</label>
              <div className="campo-con-boton">
                <input id="cantidad" type="number" className="campo-input" placeholder="" autoComplete="off" value={cantidad} onChange={e=>setCantidad(e.target.value)} />
                <button type="button" className="boton-scan" title="Escanear cantidad" onClick={() => { setScanMode(true); setScanTarget('cantidad'); }}>
                  <span role="img" aria-label="Escanear">📷</span>
                </button>
              </div>
              {scanMode && scanTarget === 'cantidad' && <div className="scan-hint">Escanea la cantidad…</div>}
            </div>
          </div>
        )}
        <button className="btn-aceptar" disabled={btnDisabled}>ACEPTAR</button>
      </main>
      <footer className="traslado-footer">
        No se ha especificado un código
      </footer>
    </div>
  );
}



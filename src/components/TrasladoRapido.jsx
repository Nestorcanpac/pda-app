import React from "react";
import "./TrasladoRapido.css";
import { useScanner } from "../hooks/useScanner";

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
  const [lote, setLote] = React.useState("");
  const [filas, setFilas] = React.useState(null); // null: sin buscar, false: no encontrado, []: resultados
  const [desc, setDesc] = React.useState("");
  const [filaSel, setFilaSel] = React.useState(null);
  const [ubicacionDestino, setUbicacionDestino] = React.useState("");
  const [almacenDestino, setAlmacenDestino] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [scanMode, setScanMode] = React.useState(false); // muestra hint cuando se pulsa escanear

  // Busca lote 1: devuelve ejemplo
  const buscarLote = React.useCallback(() => {
    if (lote.trim() === "1") {
      setDesc(
        "GJ-00100 / Gummie Jar 250ml M45-SP400 PET Natural 29gr"
      );
      setFilas([
        { id: 1, lote: "6550", almacen: "01", ubicacion: "01-UBICACION-DE-SISTEMA", cantidad: 2380, status: "DISPONIBLE" },
        { id: 2, lote: "6550", almacen: "22", ubicacion: "UBICACION-DE-SISTEMA", cantidad: 38080, status: "BLOQUEADO" },
      ]);
      setFilaSel(null);
      setUbicacionDestino("");
      setCantidad("");
      setAlmacenDestino("");
    } else {
      setDesc("");
      setFilas(false);
      setFilaSel(null);
      setUbicacionDestino("");
      setCantidad("");
      setAlmacenDestino("");
    }
  }, [lote]);

  // Escáner HID: si aún no hay resultados, interpreta como lote; si hay, como ubicación destino
  useScanner((code) => {
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
  const filaSeleccionada = Array.isArray(filas) && filaSel !== null ? filas[filaSel] : null;

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
            <input id="articulo" type="text" className="campo-input" placeholder="" autoComplete="off" value={lote} onChange={e => setLote(e.target.value)} readOnly={Array.isArray(filas)}/>
            <button type="button" className="boton-scan" title="Escanear lote" onClick={() => { setScanMode(true); setFilas(null); setDesc(''); setFilaSel(null); setUbicacionDestino(''); setCantidad(''); setAlmacenDestino(''); }}>
              <span role="img" aria-label="Escanear">📷</span>
            </button>
            <button type="button" className="boton-lupa" title="Buscar" onClick={buscarLote} disabled={Array.isArray(filas)}><span role="img" aria-label="Buscar">🔍</span></button>
          </div>
          {scanMode && <div className="scan-hint">Escanea el lote con el gatillo…</div>}
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
                <button type="button" className="boton-lupa" title="Buscar"><span role="img" aria-label="Buscar">🔍</span></button>
              </div>
            </div>
            {/* Solo mostrar almacen destino cuando hay ubicacion destino */}
            {almacenDestino && (
              <div className="campo-group">
                <label htmlFor="almacen-destino" className="campo-label">Almacén destino</label>
                <input id="almacen-destino" type="text" className="campo-input" value={almacenDestino} readOnly />
              </div>
            )}
            <div className="campo-group">
              <label htmlFor="cantidad" className="campo-label">Cantidad</label>
              <input id="cantidad" type="number" className="campo-input" placeholder="" autoComplete="off" value={cantidad} onChange={e=>setCantidad(e.target.value)} />
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



import React, { useState } from "react";
import "./Picking.css";

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const MOCK_PICKINGS = [
  {
    id: "PK-1001",
    cliente: "ACME Pharma",
    prioridad: "Alta",
    lineas: [
      { id: 1, articulo: "GJ-00100", lote: "7001", ubicacion: "A-01-01", cantidad: 120 },
      { id: 2, articulo: "GJ-00250", lote: "7002", ubicacion: "A-03-05", cantidad: 60 },
    ],
  },
  {
    id: "PK-1002",
    cliente: "Health+ Global",
    prioridad: "Media",
    lineas: [
      { id: 1, articulo: "CP-01000", lote: "7010", ubicacion: "B-02-11", cantidad: 12 },
      { id: 2, articulo: "CP-01000", lote: "7011", ubicacion: "B-06-04", cantidad: 18 },
      { id: 3, articulo: "LID-0500", lote: "9001", ubicacion: "C-01-02", cantidad: 40 },
    ],
  },
];

export default function Picking({ onBack, onLogout }) {
  const [pickings, setPickings] = useState(
    MOCK_PICKINGS.map(p => ({
      ...p,
      lineas: p.lineas.map((l, idx) => ({ ...l, order: idx, cogido: false, enZona: false }))
    }))
  );
  const [seleccion, setSeleccion] = useState(null); // id del picking expandido

  const sortLineas = (arr) => {
    return [...arr].sort((a, b) => {
      const ar = (a.cogido && a.enZona) ? 1 : 0;
      const br = (b.cogido && b.enZona) ? 1 : 0;
      if (ar !== br) return ar - br; // realizados al final
      return a.order - b.order; // orden original
    });
  };

  const toggleLinea = (pickingId, lineaId, key) => {
    setPickings(prev => {
      const updated = prev.map(p => {
        if (p.id !== pickingId) return p;
        const next = p.lineas.map(l => l.id === lineaId ? { ...l, [key]: !l[key] } : l);
        return { ...p, lineas: sortLineas(next) };
      });
      // Si el picking queda finalizado, colapsar si está abierto
      const target = updated.find(p => p.id === pickingId);
      if (target) {
        const total = target.lineas.length;
        const done = target.lineas.filter(l => l.cogido && l.enZona).length;
        if (done === total && total > 0 && seleccion === pickingId) {
          setSeleccion(null);
        }
      }
      return updated;
    });
  };

  const getPickingStatus = (p) => {
    const total = p.lineas.length;
    const done = p.lineas.filter(l => l.cogido && l.enZona).length;
    const started = p.lineas.some(l => l.cogido || l.enZona);
    return { total, done, finalizado: done === total && total > 0, started };
  };

  const getHeaderBtnLabel = (p) => {
    const st = getPickingStatus(p);
    if (seleccion === p.id) return "Pausar";
    if (st.finalizado) return "Finalizado";
    if (st.started) return "Reanudar";
    return "Iniciar";
  };

  // Particionar en pendientes y finalizados (respetando orden original por índice)
  const enrich = pickings.map((p, idx) => ({ p, idx, st: getPickingStatus(p) }));
  const pendientes = enrich.filter(x => !x.st.finalizado).sort((a,b)=>a.idx-b.idx).map(x=>x.p);
  const finalizados = enrich.filter(x => x.st.finalizado).sort((a,b)=>a.idx-b.idx).map(x=>x.p);

  const renderPickingCard = (p) => {
    const st = getPickingStatus(p);
    return (
      <section key={p.id} className={"picking-card" + (seleccion === p.id ? " sel" : "") }>
        <div className="picking-card-head" onClick={() => setSeleccion(seleccion === p.id ? null : p.id)}>
          <div>
            <div className="picking-id">{p.id}</div>
            <div className="picking-meta">{p.cliente} · Prioridad {p.prioridad}</div>
          </div>
          <div className="p-head-actions">
            <span className={"picking-status " + (st.finalizado ? "ok" : "pend")}>{st.finalizado ? "Finalizado" : "Pendiente"} · {st.done}/{st.total}</span>
            <button
              className="picking-start"
              onClick={(e)=>{
                e.stopPropagation();
                if (st.finalizado) { setSeleccion(null); return; }
                setSeleccion(seleccion === p.id ? null : p.id);
              }}
            >{getHeaderBtnLabel(p)}</button>
          </div>
        </div>

        {seleccion === p.id && !st.finalizado && (
          <div className="lineas-verticales">
            {p.lineas.map(l => {
              const realizado = l.cogido && l.enZona;
              return (
                <div key={l.id} className={"line-card" + (realizado ? " done" : "") }>
                  <div className="line-top">
                    <div className="line-field"><span className="lf-label">Artículo</span><span className="lf-value">{l.articulo}</span></div>
                    <div className="line-field"><span className="lf-label">Lote</span><span className="lf-value">{l.lote}</span></div>
                  </div>
                  <div className="line-mid">
                    <div className="line-field"><span className="lf-label">Ubicación</span><span className="lf-value">{l.ubicacion}</span></div>
                    <div className="line-field"><span className="lf-label">Cantidad</span><span className="lf-value">{l.cantidad}</span></div>
                  </div>
                  <div className="line-actions">
                    <label className="chk-row">
                      <input type="checkbox" checked={l.cogido} onChange={()=>toggleLinea(p.id, l.id, 'cogido')} />
                      <span>Cogido almacén</span>
                    </label>
                    <label className="chk-row">
                      <input type="checkbox" checked={l.enZona} onChange={()=>toggleLinea(p.id, l.id, 'enZona')} />
                      <span>En zona picking</span>
                    </label>
                    <span className={"estado-pill" + (realizado ? " ok" : "")}>{realizado ? "Realizado" : "Pendiente"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="picking-container">
      <header className="traslado-header">
        <button className="header-back" onClick={onBack} title="Atrás">&#8592;</button>
        <span className="traslado-title">Picking</span>
        <button className="header-logout" aria-label="Cerrar sesión" onClick={onLogout}><LogoutIcon /></button>
      </header>
      <main className="picking-body">
        <h2 className="picking-subtitle">Pendientes por preparar</h2>
        <div className="picking-list">
          {pendientes.map(renderPickingCard)}
        </div>

        <h2 className="picking-subtitle" style={{marginTop: '1.2rem'}}>Finalizados</h2>
        <div className="picking-list">
          {finalizados.map(renderPickingCard)}
        </div>
      </main>
      <footer className="traslado-footer">Pulsa Iniciar, Pausar o Reanudar según el estado; los finalizados se cierran solos</footer>
    </div>
  );
}

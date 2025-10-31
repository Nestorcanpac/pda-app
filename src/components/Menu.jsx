import React, { useState } from "react";
import "./Menu.css";
import TrasladoRapido from "./TrasladoRapido";

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Menu({ onLogout }) {
  const [modulo, setModulo] = useState("");
  if (modulo === "traslado") return <TrasladoRapido onBack={() => setModulo("")} onLogout={onLogout} />;

  return (
    <div className="menu-fullscreen">
      <header className="traslado-header">
        <span className="traslado-title">Menú principal</span>
        <button className="header-logout" aria-label="Cerrar sesión" onClick={onLogout}><LogoutIcon /></button>
      </header>
      <main style={{paddingTop: 66}}>
        <h1 className="menu-title">Selecciona un módulo</h1>
        <div className="menu-buttons">
          <button className="menu-btn destacado" onClick={() => setModulo("traslado")}>Traslado Rápido</button>
          <button className="menu-btn">Sección</button>
          <button className="menu-btn">Sección</button>
          <button className="menu-btn">Sección</button>
        </div>
      </main>
    </div>
  );
}

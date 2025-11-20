import React, { useState } from "react";
import "./Menu.css";
import Picking from "./Picking";
import Stock from "./Stock";
import TrasladoRapido from "./TrasladoRapido";
import QueryTest from "./QueryTest";
import { useAuth } from "../context/AuthContext";

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Menu() {
  const { logout, employeeName } = useAuth();
  const [modulo, setModulo] = useState("");
  
  const handleLogout = async () => {
    await logout();
  };
  
  if (modulo === "stock") return <Stock onBack={() => setModulo("")} onLogout={handleLogout} />;
  if (modulo === "traslado") return <TrasladoRapido onBack={() => setModulo("")} onLogout={handleLogout} />;
  if (modulo === "picking") return <Picking onBack={() => setModulo("")} onLogout={handleLogout} />;
  if (modulo === "queryTest") return <QueryTest onBack={() => setModulo("")} onLogout={handleLogout} />;

  return (
    <div className="menu-fullscreen">
      <header className="traslado-header">
        <span className="traslado-title">Menú principal</span>
        <button className="header-logout" aria-label="Cerrar sesión" onClick={handleLogout}><LogoutIcon /></button>
      </header>
      <main style={{paddingTop: 66}}>
        {employeeName && (
          <div style={{
            background: '#e8f5f6',
            color: '#0f6572',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}>
            👋 Bienvenido, {employeeName}
          </div>
        )}
        <h1 className="menu-title">Selecciona un módulo</h1>
        <div className="menu-buttons">
          <button className="menu-btn destacado" onClick={() => setModulo("traslado")}>Traslado Rápido</button>
          <button className="menu-btn destacado" onClick={() => setModulo("stock")}>Stock</button>
          <button className="menu-btn destacado" onClick={() => setModulo("picking")}>Picking</button>
          <button className="menu-btn" onClick={() => setModulo("queryTest")}>🧪 Prueba Queries</button>
        </div>
      </main>
    </div>
  );
}

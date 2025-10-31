import React, { useState } from "react";
import "./Login.css";
import Menu from "./Menu";

export default function Login() {
  const [logueado, setLogueado] = useState(false);

  if (logueado) return <Menu onLogout={() => setLogueado(false)} />;

  return (
    <div className="login-fullscreen">
      <div className="login-brand">
        <span className="heis">HEIS</span>
        <span className="circle-logo"></span>
        <span className="global">global</span>
      </div>
      <form className="login-form" onSubmit={e => {e.preventDefault(); setLogueado(true);}}>
        <h2>Iniciar sesión</h2>
        <label htmlFor="user">Usuario</label>
        <input type="text" id="user" name="user" placeholder="usuario" autoComplete="username" />
        <label htmlFor="pass">Contraseña</label>
        <input type="password" id="pass" name="pass" placeholder="contraseña" autoComplete="current-password" />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}

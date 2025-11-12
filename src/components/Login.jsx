import React, { useState } from "react";
import "./Login.css";
import Menu from "./Menu";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  // Si ya está autenticado, mostrar el menú
  if (isAuthenticated) {
    return <Menu />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!userName.trim() || !password.trim()) {
      setError("Por favor, completa todos los campos");
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Iniciando proceso de login...');
      setDebugInfo('Conectando con el servidor SAP...');
      const result = await login(userName.trim(), password);

      if (!result.success) {
        const errorMsg = result.error || "Error al iniciar sesión. Verifica tus credenciales.";
        console.error('Error en login:', errorMsg);
        setError(errorMsg);
        setDebugInfo(`Error: ${errorMsg}`);
        setIsSubmitting(false);
      } else {
        console.log('Login exitoso, redirigiendo...');
        setDebugInfo('');
        // Si es exitoso, el componente se re-renderizará y mostrará el Menu automáticamente
      }
    } catch (err) {
      console.error('Excepción capturada en handleSubmit:', err);
      const errorMsg = err.message || err.toString() || "Error desconocido al intentar iniciar sesión";
      setError(errorMsg);
      setDebugInfo(`Excepción: ${err.name} - ${errorMsg}`);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-fullscreen">
        <div className="login-loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="login-fullscreen">
      <div className="login-brand">
        <span className="heis">HEIS</span>
        <span className="circle-logo"></span>
        <span className="global">global</span>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Iniciar sesión</h2>
        {error && (
          <div className="login-error">
            <strong>Error:</strong> {error}
            {debugInfo && <div style={{marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8}}>{debugInfo}</div>}
          </div>
        )}
        {debugInfo && !error && (
          <div style={{background: '#e3f2fd', color: '#1976d2', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '0.5rem'}}>
            {debugInfo}
          </div>
        )}
        <label htmlFor="user">Usuario</label>
        <input
          type="text"
          id="user"
          name="user"
          placeholder="usuario"
          autoComplete="username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          disabled={isSubmitting}
          autoFocus
        />
        <label htmlFor="pass">Contraseña</label>
        <input
          type="password"
          id="pass"
          name="pass"
          placeholder="contraseña"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Iniciando sesión..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

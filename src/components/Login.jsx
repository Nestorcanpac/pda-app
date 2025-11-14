import React, { useState } from "react";
import "./Login.css";
import Menu from "./Menu";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, isAuthenticated, loading, backendAvailable } = useAuth();
  const [companyDB, setCompanyDB] = useState("ZZZ_SBOHEIS_22042025");
  const [userName, setUserName] = useState("manager");
  const [password, setPassword] = useState("Sap@25");
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
    setDebugInfo("");

    // Validar campos
    if (!companyDB.trim() || !userName.trim() || !password.trim()) {
      setError("Por favor, completa todos los campos");
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Iniciando proceso de login...');
      setDebugInfo('Conectando con el backend...');
      
      const result = await login(
        companyDB.trim(),
        userName.trim(),
        password
      );

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
        <div className="login-loading">Verificando conexión...</div>
      </div>
    );
  }

  // Mostrar mensaje si el backend no está disponible
  if (backendAvailable === false) {
    return (
      <div className="login-fullscreen">
        <div className="login-version">V 15</div>
        <div className="login-brand">
          <span className="heis">HEIS</span>
          <span className="circle-logo"></span>
          <span className="global">global</span>
        </div>
        <div className="login-error" style={{ maxWidth: '500px', margin: '2rem auto', padding: '1.5rem' }}>
          <strong>⚠️ Backend no disponible</strong>
          <div style={{ marginTop: '1rem', whiteSpace: 'pre-line' }}>
            No se pudo conectar al backend
            {"\n\n"}
            Por favor, verifica que:
            {"\n"}
            • El backend esté corriendo y accesible
            {"\n"}
            • La URL esté correcta en el archivo .env
            {"\n"}
            • No haya problemas de conexión o firewall
            {"\n"}
            • Si usas ngrok, verifica que el túnel esté activo
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-fullscreen">
      <div className="login-version">V 12</div>
      <div className="login-brand">
        <span className="heis">HEIS</span>
        <span className="circle-logo"></span>
        <span className="global">global</span>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Iniciar sesión</h2>
        {error && (
          <div className="login-error">
            <strong>Error:</strong> 
            <div style={{whiteSpace: 'pre-line', marginTop: '0.5rem'}}>{error}</div>
            {debugInfo && <div style={{marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8}}>{debugInfo}</div>}
          </div>
        )}
        {debugInfo && !error && (
          <div style={{background: '#e3f2fd', color: '#1976d2', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '0.5rem'}}>
            {debugInfo}
          </div>
        )}
        <label htmlFor="companyDB">Base de Datos (CompanyDB)</label>
        <input
          type="text"
          id="companyDB"
          name="companyDB"
          placeholder="ZZZ_SBOHEIS_22042025"
          autoComplete="organization"
          value={companyDB}
          onChange={(e) => setCompanyDB(e.target.value)}
          disabled={isSubmitting}
          autoFocus
        />
        <label htmlFor="user">Usuario</label>
        <input
          type="text"
          id="user"
          name="user"
          placeholder="manager"
          autoComplete="username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          disabled={isSubmitting}
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

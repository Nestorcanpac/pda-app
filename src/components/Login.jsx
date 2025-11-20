import React, { useState } from "react";
import "./Login.css";
import Menu from "./Menu";
import { useAuth } from "../context/AuthContext";
import { getEmployeeByCardNumber } from "../services/queries.service";
import { login as loginService } from "../services/auth.service";

export default function Login() {
  const { isAuthenticated, loading, backendAvailable, setEmployee, verifySession } = useAuth();
  const [cardNumber, setCardNumber] = useState("");
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

    // Validar que el código tenga 4 dígitos
    const cardNumberValue = cardNumber.trim();
    if (!cardNumberValue || cardNumberValue.length !== 4 || !/^\d{4}$/.test(cardNumberValue)) {
      setError("Por favor, introduce un código de 4 dígitos válido");
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('[Login] Verificando empleado con CardNumber:', cardNumberValue);
      setDebugInfo('Verificando código...');
      
      // 1. Verificar el empleado por CardNumber
      const employee = await getEmployeeByCardNumber(cardNumberValue);
      
      if (!employee) {
        setError("Código no encontrado. Verifica el código e intenta nuevamente.");
        setIsSubmitting(false);
        return;
      }

      console.log('[Login] Empleado encontrado:', employee);
      const employeeName = employee.DisplayName || `${employee.FirstName || ''} ${employee.LastName || ''}`.trim() || 'Usuario';
      
      setDebugInfo('Iniciando sesión en SAP...');
      
      // 2. Hacer login automático al Service Layer con credenciales fijas
      const loginResult = await loginService(
        "ZZZ_SBOHEIS_22042025",
        "manager",
        "Sap@25"
      );

      if (!loginResult.success) {
        const errorMsg = loginResult.error || "Error al iniciar sesión en SAP.";
        console.error('[Login] Error en login SAP:', errorMsg);
        setError(errorMsg);
        setDebugInfo(`Error: ${errorMsg}`);
        setIsSubmitting(false);
        return;
      }

      console.log('[Login] Login exitoso, guardando información del empleado...');
      
      // 3. Guardar el nombre del empleado en el contexto
      setEmployee(employeeName);
      
      // 4. Verificar la sesión para actualizar el estado de autenticación
      await verifySession();
      
      setDebugInfo('');
      // Si es exitoso, el componente se re-renderizará y mostrará el Menu automáticamente
    } catch (err) {
      console.error('[Login] Excepción capturada en handleSubmit:', err);
      let errorMsg = "Error al verificar el código";
      
      if (err.message) {
        errorMsg = err.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }
      
      setError(errorMsg);
      setDebugInfo(`Error: ${errorMsg}`);
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
        <div className="login-version">V 16</div>
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
        <label htmlFor="cardNumber">Código de empleado</label>
        <input
          type="text"
          id="cardNumber"
          name="cardNumber"
          placeholder="0000"
          autoComplete="off"
          value={cardNumber}
          onChange={(e) => {
            // Solo permitir números y máximo 4 dígitos
            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
            setCardNumber(value);
          }}
          disabled={isSubmitting}
          autoFocus
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]{4}"
        />
        <button type="submit" disabled={isSubmitting || cardNumber.length !== 4}>
          {isSubmitting ? "Iniciando sesión..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

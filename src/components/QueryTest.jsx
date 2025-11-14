import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { executeQuery, getStockByBin } from '../services/queries.service';
import './QueryTest.css';

export default function QueryTest({ onBack, onLogout }) {
  const { session, refreshSession } = useAuth();
  const [queryName, setQueryName] = useState('GetStockByBin');
  const [binCode, setBinCode] = useState('19-RECUENTO');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleExecuteQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Verificar sesión primero
      const hasSession = await refreshSession();
      if (!hasSession) {
        setError('No hay sesión activa. Debe hacer login primero.');
        setLoading(false);
        return;
      }

      // Ejecutar query
      let data;
      if (queryName === 'GetStockByBin') {
        data = await getStockByBin(binCode);
      } else {
        // Query genérica
        const params = queryName === 'GetStockByBin' ? { binCode } : {};
        data = await executeQuery(queryName, params);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Error al ejecutar la query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="query-test-container">
      <header className="traslado-header">
        <button className="header-back" onClick={onBack}>← Volver</button>
        <span className="traslado-title">Prueba de Queries</span>
        <button className="header-logout" onClick={onLogout}>Salir</button>
      </header>

      <main style={{ padding: '1rem', paddingTop: '66px' }}>
        <div className="query-test-section">
          <h2>Información de Sesión</h2>
          {session ? (
            <div className="session-info">
              <p><strong>Estado:</strong> {session.hasSession ? '✅ Sesión activa' : '❌ Sin sesión'}</p>
              {session.sessionId && <p><strong>Session ID:</strong> {session.sessionId.substring(0, 20)}...</p>}
              {session.version && <p><strong>Versión:</strong> {session.version}</p>}
              {session.sessionTimeout && <p><strong>Timeout:</strong> {session.sessionTimeout} minutos</p>}
            </div>
          ) : (
            <p>No hay información de sesión disponible</p>
          )}
        </div>

        <div className="query-test-section">
          <h2>Ejecutar Query</h2>
          
          <div className="form-group">
            <label htmlFor="queryName">Nombre de la Query:</label>
            <input
              type="text"
              id="queryName"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="GetStockByBin"
              disabled={loading}
            />
          </div>

          {queryName === 'GetStockByBin' && (
            <div className="form-group">
              <label htmlFor="binCode">Código del Bin:</label>
              <input
                type="text"
                id="binCode"
                value={binCode}
                onChange={(e) => setBinCode(e.target.value)}
                placeholder="UBI-001"
                disabled={loading}
              />
            </div>
          )}

          <button 
            className="query-test-btn"
            onClick={handleExecuteQuery}
            disabled={loading || !queryName.trim()}
          >
            {loading ? 'Ejecutando...' : 'Ejecutar Query'}
          </button>
        </div>

        {error && (
          <div className="query-test-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="query-test-result">
            <h3>Resultado:</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}


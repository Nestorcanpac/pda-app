import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { sapRequest } from "../services/sapService";
import "./PruebaOBBQ.css";

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function PruebaOBBQ({ onBack, onLogout }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]); // Detalles de errores
  const [itemNumber, setItemNumber] = useState(""); // Item Number a buscar
  const [queryLog, setQueryLog] = useState([]); // Log de consultas realizadas

  const consultarItem = async () => {
    if (!session?.sessionId) {
      setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
      return;
    }

    if (!itemNumber.trim()) {
      setError("Por favor, introduce un Item Number");
      return;
    }

    setLoading(true);
    setError("");
    setErrorDetails([]);
    setData(null);
    setQueryLog([]); // Limpiar log anterior

    try {
      const ItemCode = itemNumber.trim();
      console.log(`Buscando Batch Numbers (OBTN) para Item: ${ItemCode}`);
      
      // Obtener los Batch Numbers (OBTN) relacionados con el Item
      let batchNumbers = [];
      const errors = [];
      
      // Intentar diferentes métodos para obtener los batch numbers (OBTN)
      const methods = [
        // Método 1: SerialNumbers - puede contener información de lotes
        { url: `/SerialNumbers?$filter=ItemCode eq '${encodeURIComponent(ItemCode)}'`, name: 'SerialNumbers filtrado por ItemCode' },
        // Método 2: ItemWarehouseInfo - información de almacén por item
        { url: `/Items('${encodeURIComponent(ItemCode)}')/ItemWarehouseInfoCollection`, name: 'Items/ItemWarehouseInfoCollection' },
        // Método 3: Buscar en Items con expansión
        { url: `/Items('${encodeURIComponent(ItemCode)}')?$expand=ItemWarehouseInfoCollection`, name: 'Items con expansión ItemWarehouseInfo' },
        // Método 4: InventoryCountingLines filtrado
        { url: `/InventoryCountingLines?$filter=ItemCode eq '${encodeURIComponent(ItemCode)}'`, name: 'InventoryCountingLines filtrado por ItemCode' },
        // Método 5: StockTransferLines filtrado
        { url: `/StockTransferLines?$filter=ItemCode eq '${encodeURIComponent(ItemCode)}'`, name: 'StockTransferLines filtrado por ItemCode' },
        // Método 6: DeliveryNotesLines filtrado
        { url: `/DeliveryNotesLines?$filter=ItemCode eq '${encodeURIComponent(ItemCode)}'`, name: 'DeliveryNotesLines filtrado por ItemCode' },
        // Método 7: GoodsReceiptLines filtrado
        { url: `/GoodsReceiptLines?$filter=ItemCode eq '${encodeURIComponent(ItemCode)}'`, name: 'GoodsReceiptLines filtrado por ItemCode' },
        // Método 8: Obtener todos los SerialNumbers y filtrar después
        { url: `/SerialNumbers`, name: 'Todos los SerialNumbers (sin filtro)' },
      ];

      for (const method of methods) {
        try {
          const fullUrl = method.url.startsWith('/') ? method.url : `/${method.url}`;
          const baseUrl = import.meta.env.DEV ? '/api/b1s/v1' : 'https://srvhana:50000/b1s/v1';
          const completeUrl = `${baseUrl}${fullUrl}`;
          
          console.log(`Intentando método: ${method.name}`);
          console.log(`URL completa: ${completeUrl}`);
          
          // Agregar al log
          setQueryLog(prev => [...prev, {
            method: method.name,
            url: completeUrl,
            status: 'consultando...',
            timestamp: new Date().toLocaleTimeString()
          }]);
          
          const response = await sapRequest(fullUrl, session.sessionId, {
            method: 'GET',
          });
          
          console.log(`Respuesta de ${method.name}:`, response);
          
          if (response && response.value && response.value.length > 0) {
            // Si el método obtiene todos los SerialNumbers, filtrar por ItemCode manualmente
            if (method.url === '/SerialNumbers' && !method.url.includes('$filter')) {
              const filtered = response.value.filter(item => 
                (item.ItemCode && item.ItemCode === ItemCode) ||
                (item.ItemNo && item.ItemNo === ItemCode) ||
                (item.ItemNumber && item.ItemNumber === ItemCode)
              );
              if (filtered.length > 0) {
                batchNumbers = filtered;
                console.log(`✅ Encontrados ${batchNumbers.length} registros con método: ${method.name} (filtrado manualmente)`);
                setQueryLog(prev => prev.map(log => 
                  log.url === completeUrl 
                    ? { ...log, status: `✅ Éxito - ${filtered.length} registros encontrados`, records: filtered.length }
                    : log
                ));
                break;
              } else {
                setQueryLog(prev => prev.map(log => 
                  log.url === completeUrl 
                    ? { ...log, status: `⚠️ Sin resultados después de filtrar`, records: 0 }
                    : log
                ));
              }
            } else {
              // Verificar si los registros tienen el ItemCode correcto
              const validRecords = response.value.filter(item => 
                (item.ItemCode && item.ItemCode === ItemCode) ||
                (item.ItemNo && item.ItemNo === ItemCode) ||
                (item.ItemNumber && item.ItemNumber === ItemCode) ||
                !item.ItemCode // Si no tiene ItemCode, puede ser válido si viene del filtro
              );
              
              if (validRecords.length > 0) {
                batchNumbers = validRecords;
                console.log(`✅ Encontrados ${batchNumbers.length} registros con método: ${method.name}`);
                setQueryLog(prev => prev.map(log => 
                  log.url === completeUrl 
                    ? { ...log, status: `✅ Éxito - ${validRecords.length} registros encontrados`, records: validRecords.length }
                    : log
                ));
                break;
              } else {
                errors.push(`${method.name}: Se encontraron ${response.value.length} registros pero ninguno coincide con ItemCode ${ItemCode}`);
                setQueryLog(prev => prev.map(log => 
                  log.url === completeUrl 
                    ? { ...log, status: `⚠️ ${response.value.length} registros pero ninguno coincide con ItemCode`, records: response.value.length }
                    : log
                ));
              }
            }
          } else if (response && !response.value) {
            // Si la respuesta es un objeto único, verificar si tiene ItemWarehouseInfoCollection
            if (response.ItemWarehouseInfoCollection && response.ItemWarehouseInfoCollection.length > 0) {
              batchNumbers = response.ItemWarehouseInfoCollection;
              console.log(`✅ Encontrados ${batchNumbers.length} registros en ItemWarehouseInfoCollection`);
              setQueryLog(prev => prev.map(log => 
                log.url === completeUrl 
                  ? { ...log, status: `✅ Éxito - ${response.ItemWarehouseInfoCollection.length} registros en ItemWarehouseInfoCollection`, records: response.ItemWarehouseInfoCollection.length }
                  : log
              ));
              break;
            } else {
              // Convertirlo a array
              batchNumbers = [response];
              console.log(`✅ Encontrado 1 registro con método: ${method.name}`);
              setQueryLog(prev => prev.map(log => 
                log.url === completeUrl 
                  ? { ...log, status: `✅ Éxito - 1 registro encontrado`, records: 1 }
                  : log
              ));
              break;
            }
          } else {
            errors.push(`${method.name}: No se encontraron registros (respuesta vacía)`);
            setQueryLog(prev => prev.map(log => 
              log.url === completeUrl 
                ? { ...log, status: `⚠️ Respuesta vacía`, records: 0 }
                : log
            ));
          }
        } catch (methodError) {
          const errorMsg = methodError.message || methodError.toString();
          console.error(`❌ Método falló: ${method.name}`, methodError);
          console.error(`Error completo:`, methodError);
          errors.push(`${method.name}: ${errorMsg}`);
          setQueryLog(prev => prev.map(log => 
            log.url === completeUrl 
              ? { ...log, status: `❌ Error: ${errorMsg}`, records: 0 }
              : log
          ));
          continue;
        }
      }

      if (batchNumbers.length > 0) {
        // Agregar el ItemCode a cada registro si no lo tiene
        batchNumbers = batchNumbers.map(record => ({
          ...record,
          ItemCode: record.ItemCode || record.ItemNo || record.ItemNumber || ItemCode
        }));
        
        setData({ value: batchNumbers });
        setErrorDetails([]);
      } else {
        const errorMsg = `No se encontraron números de lote (OBTN) para el Item: ${ItemCode}`;
        setError(errorMsg);
        setErrorDetails(errors);
        console.error('Todos los métodos fallaron. Errores:', errors);
      }
    } catch (err) {
      console.error('Error general al consultar:', err);
      const errorMsg = err.message || err.toString() || `Error al buscar los datos OBTN para el Item: ${itemNumber}`;
      setError(errorMsg);
      setErrorDetails([`Error general: ${errorMsg}`]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="prueba-fullscreen">
      <header className="prueba-header">
        <button className="header-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="prueba-title">Prueba OBTN</span>
        <button className="header-logout" onClick={onLogout} aria-label="Cerrar sesión">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>
      <main className="prueba-main" style={{paddingTop: 66}}>
        <h2>Consulta de Item por Item Number</h2>
        
        <div className="prueba-controls">
          <label htmlFor="item-number-input">Item Number:</label>
          <input
            id="item-number-input"
            type="text"
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                consultarItem();
              }
            }}
            placeholder="Ej: PJ250SP1, RM-00001..."
            disabled={loading}
            className="prueba-input"
            autoFocus
          />
          
          <button 
            onClick={consultarItem} 
            disabled={loading || !itemNumber.trim()}
            className="prueba-btn"
          >
            {loading ? "Buscando..." : "Buscar Item"}
          </button>
        </div>

        {queryLog.length > 0 && (
          <div className="prueba-query-log">
            <h3>📋 Log de Consultas Realizadas:</h3>
            <div className="query-log-container">
              {queryLog.map((log, idx) => (
                <div key={idx} className="query-log-item">
                  <div className="query-log-header">
                    <strong>{idx + 1}. {log.method}</strong>
                    <span className="query-log-time">{log.timestamp}</span>
                  </div>
                  <div className="query-log-url">{log.url}</div>
                  <div className={`query-log-status ${log.status.includes('✅') ? 'success' : log.status.includes('❌') ? 'error' : 'warning'}`}>
                    {log.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="prueba-error">
            <strong>Error:</strong> {error}
            {errorDetails.length > 0 && (
              <details style={{marginTop: '1rem'}}>
                <summary style={{cursor: 'pointer', color: '#c33', fontWeight: '600', marginBottom: '0.5rem'}}>
                  Ver detalles de errores ({errorDetails.length} métodos intentados)
                </summary>
                <div style={{marginTop: '0.5rem', padding: '0.75rem', background: '#fff', borderRadius: '4px', fontSize: '0.9rem'}}>
                  {errorDetails.map((detail, idx) => (
                    <div key={idx} style={{marginBottom: '0.5rem', padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px'}}>
                      <strong>{idx + 1}.</strong> {detail}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {data && (
          <div className="prueba-results">
            <h3>✅ Resultados exitosos:</h3>
            <div className="prueba-info">
              <p><strong>Item Number buscado:</strong> {itemNumber}</p>
              <p><strong>Registros encontrados:</strong> {data.value ? data.value.length : 'N/A'}</p>
              {data['@odata.context'] && (
                <p><strong>Contexto OData:</strong> {data['@odata.context']}</p>
              )}
            </div>
            {data.value && data.value.length > 0 && (
              <div className="prueba-table-container">
                <h4>Datos de la tabla OBTN ({data.value.length} registros):</h4>
                <div className="prueba-table-wrapper">
                  <table className="prueba-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item No.</th>
                        <th>System Number</th>
                        <th>Batch Number</th>
                        <th>Batch Attribute 1</th>
                        <th>Batch Attribute 2</th>
                        <th>Expiry Date</th>
                        <th>Manufacturing Date</th>
                        <th>Admission Date</th>
                        <th>Warranty Start Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.value.map((row, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{row.ItemCode || row.ItemNo || row.ItemNumber || itemNumber}</td>
                          <td>{row.SystemNumber || row.SysNumber || row.SN || row.SystemSerialNumber || '-'}</td>
                          <td>{row.DistNumber || row.BatchNumber || row.BatchNum || row.DistribNumber || '-'}</td>
                          <td>{row.BatchAttribute1 || row.Attr1 || row.Attribute1 || '-'}</td>
                          <td>{row.BatchAttribute2 || row.Attr2 || row.Attribute2 || '-'}</td>
                          <td>{row.ExpiryDate || row.ExpDate || row.ExpirationDate || '-'}</td>
                          <td>{row.ManufacturingDate || row.MnfDate || row.ManufactDate || '-'}</td>
                          <td>{row.AdmissionDate || row.AdmDate || row.CreateDate || row.CreationDate || '-'}</td>
                          <td>{row.WarrantyStartDate || row.WarrantyDate || row.WarrantyStart || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <details className="prueba-details">
              <summary>Ver todos los datos (JSON completo)</summary>
              <div className="prueba-data">
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  );
}


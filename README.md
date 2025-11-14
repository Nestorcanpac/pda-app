# PDA App - Aplicación para gestión de almacén

Aplicación React para gestión de almacén con SAP Business One.

## Configuración del Servidor SAP

### Desarrollo
En desarrollo, la aplicación usa un proxy de Vite configurado en `vite.config.js` que redirige las peticiones a `/api` al servidor SAP.

### Producción
En producción, la aplicación necesita conectarse directamente al servidor SAP. Para configurar la URL del servidor:

1. **Crear archivo `.env`** en la raíz del proyecto:
```env
VITE_SAP_BASE_URL=https://192.168.1.100:50000/b1s/v1
```

**Importante:**
- Reemplaza `192.168.1.100` con la IP o dominio real de tu servidor SAP
- Si el servidor usa HTTP en lugar de HTTPS, cambia a `http://`
- El puerto por defecto es `50000`, ajústalo si es diferente
- La ruta debe terminar en `/b1s/v1`

2. **Rebuild la aplicación:**
```bash
npm run build
```

3. **Verificar la URL en la consola:**
Al abrir la aplicación en la PDA, revisa la consola del navegador. Deberías ver:
```
🔧 SAP Base URL configurada: https://...
```

### Solución de problemas de conexión

Si ves el error "Error de conexión: No se pudo conectar al servidor SAP":

1. **Verifica la URL:** Revisa la consola para ver qué URL está intentando usar
2. **Usa la IP en lugar del nombre:** Si `srvhana` no se resuelve, usa la IP del servidor
3. **Verifica el firewall:** Asegúrate de que el puerto 50000 esté abierto
4. **Verifica CORS:** El servidor SAP debe permitir peticiones desde el origen de la PDA
5. **Certificado SSL:** Si hay problemas con SSL, puedes usar HTTP (menos seguro)

## Scripts disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza el build de producción
- `npm run deploy` - Despliega a GitHub Pages

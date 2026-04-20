# RobertApp

RobertApp es un sistema integral de gestión de finanzas personales diseñado para controlar gastos multimoneda, cajitas de ahorro, y gestión de presupuesto, optimizado para ejecutarse en servidores Windows con alta disponibilidad.

## Características

- **Dashboard**: Resumen general del estado financiero con alertas tempranas.
- **Gestión de Gastos**: Seguimiento de gastos en múltiples monedas (USD, COP, EUR, TRY, etc.).
- **Perfiles / Empresas**: Separación de gastos y facturas por perfiles o empresas.
- **Cajitas de Ahorro**: Gestión de metas de ahorro y control de rendimiento con bancos (tasas de interés E.A).
- **Archivos Adjuntos**: Subida de facturas, recibos y soporte de archivos para auditoría (hasta 10MB por archivo).
- **Multimoneda en Tiempo Real**: Conversión automática a COP (Peso Colombiano) conservando la tasa de cambio histórica en el momento del registro.

---

## 🛠️ Guía de Instalación Manual (Servidor Windows)

Para desplegar este proyecto en un servidor Windows asegurando su funcionamiento 24/7 y la disponibilidad tras posibles reinicios del sistema, se deben seguir estos pasos de manera rigurosa.

### 1. Requisitos Previos

Asegúrate de contar con lo siguiente instalado en tu servidor:
- **Node.js** (Versión 20+ recomendada). Verifica con `node -v` y `npm -v`.
- **Git** (Para control de versiones).
- **PM2** (Gestor de procesos de Node.js): Se instala globalmente ejecutando `npm install -g pm2`.
- **Cloudflare Tunnel (Opcional pero recomendado)** para exponer la aplicación al internet sin abrir puertos en el router (`cloudflared`).

### 2. Clonar el Repositorio

Clona el proyecto en una ruta accesible, por ejemplo `C:\proyectos\RobertApp`:
```powershell
mkdir C:\proyectos
cd C:\proyectos
git clone <URL_DEL_REPOSITORIO> RobertApp
cd RobertApp
```

### 3. Configurar el Backend

El backend gestiona la base de datos (SQLite), la API, la autenticación y la gestión de archivos.

1. **Instalar dependencias:**
   ```powershell
   cd C:\proyectos\RobertApp\backend
   npm install
   ```

2. **Variables de entorno:**
   Crea un archivo `.env` en la ruta `C:\proyectos\RobertApp\backend\.env` y configura lo siguiente:
   ```env
   PORT=3001
   JWT_SECRET=tu_secreto_super_seguro_aqui
   DB_PATH=./data/robertapp.db
   ```

3. **Inicializar la base de datos (Semilla):**
   Para preparar la estructura SQLite y crear el usuario administrador por defecto (`robert` / `robert2026`):
   ```powershell
   npx tsx src/database/seed.ts
   ```

### 4. Configurar el Frontend

El frontend está desarrollado en React con Vite. Usaremos un build estático para máxima seguridad y rendimiento.

1. **Instalar dependencias:**
   ```powershell
   cd C:\proyectos\RobertApp\frontend
   npm install
   ```

2. **Compilar para producción:**
   ```powershell
   npm run build
   ```
   *Nota: Vite está configurado para permitir `allowedHosts: true` en el modo preview, de manera que Cloudflare pueda enrutar el tráfico externo hacia tu localhost.*

### 5. Configuración de Alta Disponibilidad con PM2 (24/7)

Debido a ciertas restricciones de rutas y permisos en Windows al ejecutar scripts (`.bat`/`.cmd`), configuraremos PM2 para que llame directamente al binario de Node.js `node.exe`.

1. **Revisar `ecosystem.config.js`:**
   En la raíz del proyecto (`C:\proyectos\RobertApp\ecosystem.config.js`) se encuentra el archivo de PM2 configurado para el entorno Windows.

2. **Iniciar los servicios con PM2:**
   Vuelve a la raíz del proyecto y ejecuta:
   ```powershell
   cd C:\proyectos\RobertApp
   pm2 start ecosystem.config.js
   ```

3. **Persistencia tras el Reinicio de Windows:**
   Es esencial configurar PM2 para que se ejecute en el inicio de la máquina. Windows no tiene un equivalente directo a `systemd` nativo, así que utilizamos la utilidad `pm2-startup` (O alternativamente pm2-installer):
   ```powershell
   npm install -g pm2-windows-startup
   pm2-startup install
   pm2 save
   ```
   *Esto guarda la lista actual de procesos y la levantará automáticamente en cuanto inicie sesión el servidor.*

### 6. Exposición al Internet mediante Cloudflare Tunnels (Zero Trust)

Una vez los servicios estén levantados (puedes verificar su estado con `pm2 status`), la aplicación estará corriendo en `http://localhost:5173`. 

Para hacerla accesible globalmente sin depender de IP Públicas:
1. Ve al Dashboard de Cloudflare (Zero Trust).
2. Ve a **Networks > Tunnels** y selecciona el túnel de tu servidor (`servidor-robert`).
3. Ve a **Public Hostnames** y agrega uno nuevo:
   - **Subdomain:** `gastos` (o el de tu elección)
   - **Domain:** `tudominio.com`
   - **Service Type:** `HTTP`
   - **URL:** `localhost:5173`

La configuración de proxy dentro de Vite (`preview`) enviará automáticamente todas las llamadas `/api` hacia el backend en el puerto `3001`.

### Mantenimiento y Comandos Útiles

- **Ver el estado de la aplicación:** `pm2 status`
- **Ver los logs de errores o actividad:** `pm2 logs` (o específicamente `pm2 logs robertapp-backend`)
- **Reiniciar servicios tras una actualización de código:** 
  ```powershell
  git pull
  cd backend; npm install
  cd ../frontend; npm install; npm run build
  cd ..
  pm2 restart all
  ```
- **Resetear datos de prueba sin perder la cuenta principal:**
  ```powershell
  cd backend
  npx tsx src/database/clear-data.ts
  ```

---
**Usuario de Acceso:** `robert`  
**Contraseña por defecto:** `robert2026`  
*(Se recomienda cambiar la contraseña desde el panel de usuario al iniciar sesión por primera vez).*

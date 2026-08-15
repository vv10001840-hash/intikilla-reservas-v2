# IntiKilla - Sistema de Reservas de Mesas

Prototipo académico desarrollado con React 18 y Vite para registrar, consultar y cancelar reservas de mesas.

## Funcionalidades

- Portal de cliente con selección de fecha, hora, personas y mesa.
- Mesas libres en verde y mesas ocupadas en gris.
- Validación de conflictos antes de confirmar.
- Confirmación adaptable a celular con botón para volver al inicio.
- Panel administrador para reservas telefónicas, calendario, mesas y reportes.
- Persistencia real de mesas y reservas en MySQL (`bd_intikilla`).
- API REST en JavaScript y actualización en tiempo real con Server-Sent Events (SSE).
- `localStorage` y `BroadcastChannel` se conservan como cache local de respaldo de la interfaz.

## Integraciones con APIs externas

- **Correo de confirmación (Resend):** al registrar una reserva, el backend
  llama a la API REST de [Resend](https://resend.com) para enviar un correo
  de confirmación al cliente. Ver `server/notifications.js`. Requiere una
  cuenta gratuita y las variables `RESEND_API_KEY` / `NOTIFICATIONS_FROM_EMAIL`
  en `.env`. Si no están configuradas, la reserva se registra igual y solo
  se omite el envío (no rompe la app).
- **WhatsApp:** la pantalla de confirmación genera un enlace `wa.me` con los
  datos de la reserva precargados, usando la API de enlaces de WhatsApp.
  El número del restaurante se define en `RESTAURANT_WHATSAPP` (`src/App.jsx`).

## Hooks y optimización

- `useState` y `useEffect` para formularios, persistencia y efectos secundarios.
- `useReducer` para crear, cancelar, actualizar y sincronizar reservas.
- `useMemo`, `useCallback` y `React.memo` para evitar cálculos y renders innecesarios.

## Ejecución

```powershell
Copy-Item .env.example .env
# Editar .env y colocar solamente la contraseña local de MySQL en DB_PASSWORD.
npm install
```

### Paso previo obligatorio: crear la base de datos y el usuario en MySQL

El servidor se conecta a MySQL con un usuario y una base llamados `bd_intikilla`
(ver `server/database.js`). Ese usuario **no viene creado por defecto en MySQL**:
hay que crearlo una sola vez antes de iniciar el proyecto.

1. Abre "MySQL Command Line Client" (o MySQL Workbench) e inicia sesión como `root`.
2. Ejecuta el script `database/setup_usuario.sql` (cámbiale la contraseña de ejemplo
   antes de correrlo), o desde PowerShell:
   ```powershell
   mysql -u root -p < database/setup_usuario.sql
   ```
3. Copia esa misma contraseña en el archivo `.env`, en `DB_PASSWORD`.
4. Verifica la conexión con `npm run db:init` (crea las tablas) y luego `npm run dev`.

```powershell
npm run dev
```

Abrir `http://127.0.0.1:5173/`. El mismo comando inicia Vite y la API en el puerto 3001.

## Base de datos y API

- El esquema se encuentra en `database/schema.sql` y se inicializa automáticamente al ejecutar `npm run dev`.
- `mesas`, `reservas` y `reservas_activas` son las tablas utilizadas. La última evita reservas duplicadas de una misma mesa, fecha y hora.
- Rutas principales: `GET /api/state`, `POST /api/reservas`, `PATCH /api/reservas/:id`, `PATCH /api/mesas/:id` y `GET /api/events`.
- Para inicializar manualmente: `npm run db:init`.
- Para comprobar la conexión: `http://127.0.0.1:3001/api/health`.

## Pruebas y build

```powershell
npm test
npm run build
```

Las pruebas usan Jest y Testing Library. El flujo de CI se encuentra en `.github/workflows/ci.yml`.

## Acceso administrador

- Usuario: `admin@intikilla.pe`
- Password: `admin`

## Prototipo

[Wireframes de IntiKilla en Figma](https://www.figma.com/design/fKg2wtNikltXAYY1KGe5MS/IntiKilla-Reservas-UX-UI---12-Wireframes?node-id=2-2)

Proyecto académico - Zegel IPAE, curso Desarrollo de Interfaces 2.

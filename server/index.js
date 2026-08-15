import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { getState, initializeDatabase, pool, toReservation } from './database.js'
import { sendConfirmationEmail } from './notifications.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const app = express()
// Railway (y la mayoría de plataformas de hosting) asignan el puerto
// automáticamente en la variable PORT. En desarrollo local no existe esa
// variable, así que usamos API_PORT/3001 como respaldo.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
const clients = new Set()
let databaseReady = false

app.use(express.json())
// Sirve el frontend ya compilado (npm run build genera esta carpeta dist/).
// En desarrollo local, dist/ no existe todavia y esto simplemente no encuentra
// archivos, dejando que Vite (puerto 5173) siga sirviendo la interfaz.
app.use(express.static(distDir))

function sendError(response, status, message) {
  response.status(status).json({ error: message })
}

function validateReservation(raw = {}) {
  const reservation = {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : crypto.randomUUID(),
    cliente: String(raw.cliente ?? '').trim(),
    email: String(raw.email ?? '').trim(),
    telefono: String(raw.telefono ?? '').trim(),
    fecha: String(raw.fecha ?? ''),
    hora: String(raw.hora ?? ''),
    mesa: Number(raw.mesa),
    personas: Number(raw.personas),
    estado: raw.estado === 'Pendiente' ? 'Pendiente' : 'Confirmada',
    origen: String(raw.origen ?? 'Web').trim() || 'Web',
    notas: String(raw.notas ?? '').trim(),
  }
  const timeIsValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(reservation.hora)
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(reservation.fecha)
  if (!reservation.cliente || !dateIsValid || !timeIsValid || !Number.isInteger(reservation.mesa) || reservation.mesa < 1 || !Number.isInteger(reservation.personas) || reservation.personas < 1) {
    return null
  }
  return reservation
}

function notifyStateChanged() {
  for (const client of clients) client.write('event: state-updated\ndata: actualizado\n\n')
}

function requireDatabase(response) {
  if (databaseReady) return true
  sendError(response, 503, 'La base de datos no esta disponible. Revisa el archivo .env y MySQL.')
  return false
}

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, database: 'bd_intikilla' })
  } catch {
    sendError(response, 503, 'No se pudo conectar con MySQL.')
  }
})

app.get('/api/events', (request, response) => {
  response.set({
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
  })
  response.flushHeaders()
  response.write('retry: 3000\n\n')
  clients.add(response)
  const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 25000)
  request.on('close', () => {
    clearInterval(keepAlive)
    clients.delete(response)
  })
})

app.get('/api/state', async (_request, response) => {
  if (!requireDatabase(response)) return
  try {
    response.json(await getState())
  } catch {
    sendError(response, 500, 'No se pudo consultar la informacion de reservas.')
  }
})

app.post('/api/reservas', async (request, response) => {
  if (!requireDatabase(response)) return
  const reservation = validateReservation(request.body)
  if (!reservation) return sendError(response, 400, 'Datos de reserva incompletos o invalidos.')

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      `INSERT INTO reservas (id, cliente, email, telefono, fecha, hora, mesa_id, personas, estado, origen, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reservation.id, reservation.cliente, reservation.email, reservation.telefono, reservation.fecha, reservation.hora, reservation.mesa, reservation.personas, reservation.estado, reservation.origen, reservation.notas],
    )
    await connection.execute(
      'INSERT INTO reservas_activas (mesa_id, fecha, hora, reserva_id) VALUES (?, ?, ?, ?)',
      [reservation.mesa, reservation.fecha, reservation.hora, reservation.id],
    )
    await connection.commit()
    notifyStateChanged()

    // Integración con API externa (Resend): se ejecuta después de confirmar
    // la transacción para que un fallo de red al enviar el correo nunca
    // afecte el registro de la reserva. El resultado se informa al cliente
    // en la respuesta, pero no cambia el código de estado HTTP.
    const notificacionEmail = await sendConfirmationEmail(reservation)

    response.status(201).json({ ...reservation, notificacionEmail })
  } catch (error) {
    await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') return sendError(response, 409, 'La mesa ya esta ocupada para esa fecha y hora.')
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return sendError(response, 400, 'La mesa seleccionada no existe.')
    sendError(response, 500, 'No se pudo registrar la reserva.')
  } finally {
    connection.release()
  }
})

app.patch('/api/reservas/:id', async (request, response) => {
  if (!requireDatabase(response)) return
  const estado = request.body?.estado
  if (!['Confirmada', 'Pendiente', 'Cancelada'].includes(estado)) {
    return sendError(response, 400, 'Estado de reserva invalido.')
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      'SELECT id, cliente, email, telefono, fecha, hora, mesa_id, personas, estado, origen, notas FROM reservas WHERE id = ? FOR UPDATE',
      [request.params.id],
    )
    if (rows.length === 0) {
      await connection.rollback()
      return sendError(response, 404, 'Reserva no encontrada.')
    }
    const current = rows[0]
    if (current.estado !== 'Cancelada' && estado === 'Cancelada') {
      await connection.execute('DELETE FROM reservas_activas WHERE reserva_id = ?', [current.id])
    }
    if (current.estado === 'Cancelada' && estado !== 'Cancelada') {
      await connection.execute(
        'INSERT INTO reservas_activas (mesa_id, fecha, hora, reserva_id) VALUES (?, ?, ?, ?)',
        [current.mesa_id, current.fecha, current.hora, current.id],
      )
    }
    await connection.execute('UPDATE reservas SET estado = ? WHERE id = ?', [estado, current.id])
    await connection.commit()
    const reservation = toReservation({ ...current, estado })
    notifyStateChanged()
    response.json(reservation)
  } catch (error) {
    await connection.rollback()
    if (error.code === 'ER_DUP_ENTRY') return sendError(response, 409, 'No se puede reactivar: la mesa ya esta ocupada.')
    sendError(response, 500, 'No se pudo actualizar la reserva.')
  } finally {
    connection.release()
  }
})

app.patch('/api/mesas/:id', async (request, response) => {
  if (!requireDatabase(response)) return
  const estado = request.body?.estado
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || !['Activa', 'Mantenimiento'].includes(estado)) {
    return sendError(response, 400, 'Datos de mesa invalidos.')
  }
  try {
    const [result] = await pool.execute('UPDATE mesas SET estado = ? WHERE id = ?', [estado, id])
    if (result.affectedRows === 0) return sendError(response, 404, 'Mesa no encontrada.')
    const [rows] = await pool.execute('SELECT id, capacidad, zona, estado FROM mesas WHERE id = ?', [id])
    const mesa = { ...rows[0], id: Number(rows[0].id), capacidad: Number(rows[0].capacidad) }
    notifyStateChanged()
    response.json(mesa)
  } catch {
    sendError(response, 500, 'No se pudo actualizar la mesa.')
  }
})

// Catch-all: cualquier ruta que no sea /api/... y no coincida con un archivo
// estatico devuelve index.html, para que la app de React maneje la navegacion.
// Debe ir despues de todas las rutas /api definidas arriba.
app.get(/^(?!\/api).*/, (request, response) => {
  response.sendFile(path.join(distDir, 'index.html'), (error) => {
    if (error) response.status(404).send('Interfaz no compilada: ejecuta "npm run build" primero.')
  })
})

async function start() {
  try {
    await initializeDatabase()
    databaseReady = true
    console.log('MySQL conectado y esquema de IntiKilla listo.')
  } catch (error) {
    console.error('La API inicia en modo seguro, pero MySQL no esta disponible:', error.code ?? error.message)
  }
  app.listen(port, () => console.log(`API de IntiKilla disponible en http://127.0.0.1:${port}`))
}

start()
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(currentDirectory, '..', 'database', 'schema.sql')

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'bd_intikilla',
  user: process.env.DB_USER ?? 'bd_intikilla',
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  multipleStatements: true,
})

export async function initializeDatabase() {
  const schema = await fs.readFile(schemaPath, 'utf8')
  const connection = await pool.getConnection()
  try {
    await connection.query(schema)
  } finally {
    connection.release()
  }
}

export function toReservation(row) {
  return {
    id: row.id,
    cliente: row.cliente,
    email: row.email,
    telefono: row.telefono,
    fecha: row.fecha,
    hora: String(row.hora).slice(0, 5),
    mesa: Number(row.mesa_id),
    personas: Number(row.personas),
    estado: row.estado,
    origen: row.origen,
    notas: row.notas,
  }
}

export async function getState() {
  const [mesasResult, reservasResult] = await Promise.all([
    pool.query('SELECT id, capacidad, zona, estado FROM mesas ORDER BY id'),
    pool.query(`SELECT id, cliente, email, telefono, fecha, hora, mesa_id, personas, estado, origen, notas
      FROM reservas ORDER BY creada_en DESC`),
  ])

  return {
    mesas: mesasResult[0].map((mesa) => ({ ...mesa, id: Number(mesa.id), capacidad: Number(mesa.capacidad) })),
    reservas: reservasResult[0].map(toReservation),
  }
}

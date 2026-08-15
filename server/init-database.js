import { initializeDatabase, pool } from './database.js'

try {
  await initializeDatabase()
  console.log('Base de datos IntiKilla inicializada correctamente.')
} finally {
  await pool.end()
}

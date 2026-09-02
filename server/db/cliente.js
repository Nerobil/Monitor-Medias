const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

/**
 * Cliente de base de datos. Si TURSO_DATABASE_URL esta definido, se conecta a
 * Turso (nube, gratis). Si no, usa un fichero SQLite local (./data/monitor.db),
 * ideal para desarrollo/pruebas sin depender de internet.
 */
function crearClienteDb() {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (TURSO_DATABASE_URL) {
    return createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  }
  const rutaLocal = path.join(__dirname, '..', 'data', 'monitor.db');
  fs.mkdirSync(path.dirname(rutaLocal), { recursive: true });
  return createClient({ url: `file:${rutaLocal}` });
}

const db = crearClienteDb();

/**
 * Aplica el esquema (CREATE TABLE IF NOT EXISTS...). Seguro de llamar en cada
 * arranque: no borra datos existentes.
 */
async function aplicarEsquema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const sentencias = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentencia of sentencias) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.execute(sentencia);
    } catch (err) {
      throw new Error(`Fallo aplicando el esquema en:\n${sentencia}\n\nError original: ${err.message}`);
    }
  }
}
module.exports = { db, aplicarEsquema };

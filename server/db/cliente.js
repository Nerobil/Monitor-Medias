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
 *
 * Se ejecuta sentencia por sentencia con `db.execute()` en vez de
 * `db.executeMultiple()`: es el metodo que Turso documenta y prueba para su
 * transporte remoto (HTTP); `executeMultiple` esta pensado sobre todo para
 * SQLite local/embebido y puede comportarse de forma distinta en remoto.
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
  await aplicarMigracionesColumnas();
}

/**
 * "CREATE TABLE IF NOT EXISTS" no anade columnas nuevas a una tabla que ya
 * existia de antes con menos columnas (tu base de datos de Turso ya tenia la
 * tabla "alertas" sin "tv_symbol" antes de anadir esta funcionalidad). Se
 * anade aqui de forma segura: si la columna ya existe (instalacion nueva,
 * donde el CREATE TABLE de arriba ya la trae), se ignora el error.
 */
async function aplicarMigracionesColumnas() {
  const migraciones = [
    'ALTER TABLE alertas ADD COLUMN tv_symbol TEXT',
  ];
  for (const migracion of migraciones) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.execute(migracion);
    } catch (err) {
      if (!/duplicate column name/i.test(err.message)) throw err;
    }
  }
}

module.exports = { db, aplicarEsquema };

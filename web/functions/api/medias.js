import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

/** GET /api/medias -> las 4 posiciones configuradas (1 y 2 alimentan la tendencia del panel) */
export async function onRequestGet({ env }) {
  try {
    const db = clienteDb(env);
    const rs = await db.execute('SELECT * FROM config_medias ORDER BY posicion');
    const medias = rs.rows.map((r) => ({ ...r, etiqueta: `${r.tipo} ${r.periodo}` }));
    return jsonOk({ medias });
  } catch (err) {
    return jsonError(err.message);
  }
}

/** POST /api/medias  { posicion: 1-4, tipo: SMA|EMA|WMA|SMMA, periodo } */
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (![1, 2, 3, 4].includes(Number(b.posicion)) || !b.tipo || !b.periodo) {
      return jsonError('posicion (1-4), tipo y periodo son obligatorios', 400);
    }
    const db = clienteDb(env);
    await db.execute({
      sql: `INSERT INTO config_medias (posicion, tipo, periodo) VALUES (?, ?, ?)
            ON CONFLICT(posicion) DO UPDATE SET tipo = excluded.tipo, periodo = excluded.periodo`,
      args: [Number(b.posicion), b.tipo, Number(b.periodo)],
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err.message, 400);
  }
}

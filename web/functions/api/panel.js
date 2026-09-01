import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

export async function onRequestGet({ env }) {
  try {
    const db = clienteDb(env);

    const activosRs = await db.execute(`
      SELECT u.id, u.nombre, u.mercado, u.categoria, u.divisa,
             s.precio_actual, s.var_dia, s.var_5d, s.var_1m, s.var_3m, s.var_ytd, s.var_1a, s.var_5a,
             s.rsi, s.tendencias_json, s.distancia_medias_json, s.actualizado_en
      FROM universo_activos u
      JOIN (SELECT DISTINCT activo_id FROM alertas WHERE estado = 'activa') a ON a.activo_id = u.id
      LEFT JOIN snapshot_activo s ON s.activo_id = u.id
      ORDER BY s.actualizado_en DESC
    `);

    const activos = [];
    for (const act of activosRs.rows) {
      const alertasRs = await db.execute({
        sql: "SELECT * FROM alertas WHERE activo_id = ? AND estado = 'activa' ORDER BY detectada_en DESC",
        args: [act.id],
      });
      activos.push({
        ...act,
        tendencias: JSON.parse(act.tendencias_json || '{}'),
        distanciaMedias: JSON.parse(act.distancia_medias_json || '[]'),
        alertas: alertasRs.rows,
      });
    }

    const tfRs = await db.execute('SELECT * FROM config_timeframes ORDER BY rowid');
    const rsiRs = await db.execute({ sql: 'SELECT valor FROM config_general WHERE clave = ?', args: ['mostrar_rsi'] });
    const mostrarRsi = rsiRs.rows.length ? rsiRs.rows[0].valor === 'true' : true;

    return jsonOk({ activos, timeframes: tfRs.rows, mostrarRsi });
  } catch (err) {
    return jsonError(err.message);
  }
}

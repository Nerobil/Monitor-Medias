import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

/**
 * Lista de alertas activas (menos de 36h), mas nuevas primero, con filtro
 * opcional por timeframe (?timeframe=60). Una unica consulta con el contexto
 * del activo (precio, RSI, tendencias) ya incluido via LEFT JOIN - tan ligera
 * con 10 alertas activas como con 1000, y sin acercarse al limite de
 * peticiones salientes de Cloudflare.
 */
export async function onRequestGet({ request, env }) {
  try {
    const db = clienteDb(env);
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe');

    const base = `
      SELECT a.id, a.activo_id, a.nombre_activo, a.tv_symbol, a.mercado, a.timeframe,
             a.media_rapida, a.media_lenta, a.direccion, a.nivel, a.mensaje,
             a.precio_en_cruce, a.detectada_en,
             s.precio_actual, s.var_dia, s.var_5d, s.var_1m, s.var_3m, s.var_ytd, s.var_1a, s.var_5a,
             s.rsi, s.tendencias_json
      FROM alertas a
      LEFT JOIN snapshot_activo s ON s.activo_id = a.activo_id
      WHERE a.estado = 'activa'`;

    const alertasRs = timeframe
      ? await db.execute({ sql: `${base} AND a.timeframe = ? ORDER BY a.detectada_en DESC`, args: [timeframe] })
      : await db.execute(`${base} ORDER BY a.detectada_en DESC`);

    const alertas = alertasRs.rows.map((r) => ({ ...r, tendencias: JSON.parse(r.tendencias_json || '{}') }));

    const tfRs = await db.execute('SELECT * FROM config_timeframes ORDER BY rowid');
    const rsiRs = await db.execute({ sql: 'SELECT valor FROM config_general WHERE clave = ?', args: ['mostrar_rsi'] });
    const mostrarRsi = rsiRs.rows.length ? rsiRs.rows[0].valor === 'true' : true;

    return jsonOk({ alertas, timeframes: tfRs.rows, mostrarRsi });
  } catch (err) {
    return jsonError(err.message);
  }
}

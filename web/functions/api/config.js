import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

async function leerConfigGeneral(db, clave, porDefecto) {
  const rs = await db.execute({ sql: 'SELECT valor FROM config_general WHERE clave = ?', args: [clave] });
  return rs.rows.length ? rs.rows[0].valor === 'true' : porDefecto;
}

export async function onRequestGet({ env }) {
  try {
    const db = clienteDb(env);
    const tfRs = await db.execute('SELECT * FROM config_timeframes ORDER BY rowid');
    const mostrarRsi = await leerConfigGeneral(db, 'mostrar_rsi', true);
    const canalTelegram = await leerConfigGeneral(db, 'canal_telegram', true);
    const canalEmail = await leerConfigGeneral(db, 'canal_email', true);
    return jsonOk({
      timeframes: tfRs.rows, mostrarRsi, canalTelegram, canalEmail,
    });
  } catch (err) {
    return jsonError(err.message);
  }
}

/**
 * POST /api/config  { tipo: 'timeframe', timeframe: '15', mostrar_en_panel: true, vigilar_cruces: true }
 * POST /api/config  { tipo: 'rsi', activo: true }
 * POST /api/config  { tipo: 'canal', canal: 'telegram' | 'email', activo: true }
 */
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const db = clienteDb(env);

    if (body.tipo === 'rsi') {
      await db.execute({
        sql: `INSERT INTO config_general (clave, valor) VALUES ('mostrar_rsi', ?)
              ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
        args: [body.activo ? 'true' : 'false'],
      });
      return jsonOk({ ok: true });
    }

    if (body.tipo === 'canal') {
      if (!['telegram', 'email'].includes(body.canal)) return jsonError('canal debe ser "telegram" o "email"', 400);
      const clave = `canal_${body.canal}`;
      await db.execute({
        sql: `INSERT INTO config_general (clave, valor) VALUES (?, ?)
              ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
        args: [clave, body.activo ? 'true' : 'false'],
      });
      return jsonOk({ ok: true });
    }

    if (body.tipo === 'timeframe') {
      const campos = [];
      const args = [];
      if (body.mostrar_en_panel !== undefined) { campos.push('mostrar_en_panel = ?'); args.push(body.mostrar_en_panel ? 1 : 0); }
      if (body.vigilar_cruces !== undefined) { campos.push('vigilar_cruces = ?'); args.push(body.vigilar_cruces ? 1 : 0); }
      if (!campos.length) return jsonError('Nada que actualizar', 400);
      args.push(body.timeframe);
      await db.execute({ sql: `UPDATE config_timeframes SET ${campos.join(', ')} WHERE timeframe = ?`, args });
      return jsonOk({ ok: true });
    }

    return jsonError('tipo desconocido (usa "rsi", "canal" o "timeframe")', 400);
  } catch (err) {
    return jsonError(err.message);
  }
}

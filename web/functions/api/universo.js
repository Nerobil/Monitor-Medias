import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

export async function onRequestGet({ env }) {
  try {
    const db = clienteDb(env);
    const rs = await db.execute('SELECT * FROM universo_activos ORDER BY nombre');
    return jsonOk({ activos: rs.rows });
  } catch (err) {
    return jsonError(err.message);
  }
}

/**
 * POST /api/universo  { categoria, mercado, nombre, ticker, isin, divisa, tvSymbol, estado }
 * Da de alta un activo nuevo. Sin limite de filas.
 */
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (!b.nombre || !b.tvSymbol) return jsonError('Faltan campos obligatorios: nombre, tvSymbol', 400);
    const db = clienteDb(env);
    await db.execute({
      sql: `INSERT INTO universo_activos (categoria, mercado, nombre, ticker, isin, divisa, tv_symbol, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        b.categoria || null, b.mercado || null, b.nombre, b.ticker || null,
        b.isin || null, b.divisa || null, b.tvSymbol, b.estado || 'Activo',
      ],
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err.message, 400);
  }
}

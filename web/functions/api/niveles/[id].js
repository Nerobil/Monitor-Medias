import { clienteDb, jsonOk, jsonError } from '../../_lib/db.js';

/** DELETE /api/niveles/<id> -> borra esa regla; deja de vigilarse ese cruce. */
export async function onRequestDelete({ params, env }) {
  try {
    const db = clienteDb(env);
    const rs = await db.execute({ sql: 'DELETE FROM niveles_importancia WHERE id = ?', args: [params.id] });
    return jsonOk({ ok: true, borrada: rs.rowsAffected > 0 });
  } catch (err) {
    return jsonError(err.message);
  }
}

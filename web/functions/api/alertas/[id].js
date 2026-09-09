import { clienteDb, jsonOk, jsonError } from '../../_lib/db.js';

/**
 * DELETE /api/alertas/<id>  ->  borra esa alerta de forma manual y
 * definitiva, independiente del borrado automatico por antiguedad (36h).
 */
export async function onRequestDelete({ params, env }) {
  try {
    const db = clienteDb(env);
    const rs = await db.execute({ sql: 'DELETE FROM alertas WHERE id = ?', args: [params.id] });
    return jsonOk({ ok: true, borrada: rs.rowsAffected > 0 });
  } catch (err) {
    return jsonError(err.message);
  }
}

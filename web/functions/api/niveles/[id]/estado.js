import { clienteDb, jsonOk, jsonError } from '../../../_lib/db.js';

export async function onRequestPost({ request, params, env }) {
  try {
    const b = await request.json();
    const db = clienteDb(env);
    await db.execute({
      sql: 'UPDATE niveles_importancia SET activo = ? WHERE id = ?',
      args: [b.activo ? 1 : 0, params.id],
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err.message);
  }
}

import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const limite = Math.min(Number(url.searchParams.get('limite')) || 50, 500);
    const offset = Number(url.searchParams.get('offset')) || 0;

    const db = clienteDb(env);
    const rs = await db.execute({
      sql: "SELECT * FROM alertas WHERE estado = 'historico' ORDER BY detectada_en DESC LIMIT ? OFFSET ?",
      args: [limite, offset],
    });
    return jsonOk({ historico: rs.rows });
  } catch (err) {
    return jsonError(err.message);
  }
}

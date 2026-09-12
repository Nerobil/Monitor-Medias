import { clienteDb, jsonOk, jsonError } from '../../../_lib/db.js';

/**
 * POST /api/universo/<id>/estado  { estado: 'Activo' | 'Inactivo' }
 * Activa o desactiva un activo sin borrarlo: sigue apareciendo en la lista
 * de Universo_Activos (y se puede reactivar en cualquier momento), pero
 * mientras este "Inactivo" el ciclo de vigilancia lo ignora por completo
 * (listarActivosActivos solo trae los que tienen estado = 'Activo').
 */
export async function onRequestPost({ request, params, env }) {
  try {
    const b = await request.json();
    if (!['Activo', 'Inactivo'].includes(b.estado)) return jsonError('estado debe ser "Activo" o "Inactivo"', 400);
    const db = clienteDb(env);
    await db.execute({
      sql: "UPDATE universo_activos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?",
      args: [b.estado, params.id],
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err.message);
  }
}

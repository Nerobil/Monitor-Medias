import { clienteDb, jsonOk, jsonError } from '../_lib/db.js';

/** GET /api/niveles -> lista de reglas de cruce vigiladas */
export async function onRequestGet({ env }) {
  try {
    const db = clienteDb(env);
    const rs = await db.execute('SELECT * FROM niveles_importancia ORDER BY timeframe, nivel');
    return jsonOk({ niveles: rs.rows });
  } catch (err) {
    return jsonError(err.message);
  }
}

/**
 * POST /api/niveles  { mediaRapida, mediaLenta, timeframe, nivel, descripcion }
 * Da de alta o actualiza una regla (la combinacion media_rapida/media_lenta/
 * timeframe es unica: si ya existia, se actualiza el nivel).
 */
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (!b.mediaRapida || !b.mediaLenta || !b.timeframe || !b.nivel) {
      return jsonError('Faltan campos obligatorios: mediaRapida, mediaLenta, timeframe, nivel', 400);
    }
    const db = clienteDb(env);
    await db.execute({
      sql: `INSERT INTO niveles_importancia (media_rapida, media_lenta, timeframe, nivel, descripcion)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(media_rapida, media_lenta, timeframe) DO UPDATE SET
              nivel = excluded.nivel, descripcion = excluded.descripcion`,
      args: [b.mediaRapida, b.mediaLenta, b.timeframe, b.nivel, b.descripcion || null],
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err.message, 400);
  }
}

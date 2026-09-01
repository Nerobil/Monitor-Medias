const { db } = require('./cliente');

// ---------- Universo de activos ----------

async function listarActivosActivos() {
  const rs = await db.execute("SELECT * FROM universo_activos WHERE estado = 'Activo' ORDER BY nombre");
  return rs.rows;
}

async function listarTodosLosActivos() {
  const rs = await db.execute('SELECT * FROM universo_activos ORDER BY nombre');
  return rs.rows;
}

async function crearActivo(activo) {
  const {
    categoria = null, mercado = null, nombre, ticker = null, isin = null,
    divisa = null, tvSymbol, estado = 'Activo',
  } = activo;
  const rs = await db.execute({
    sql: `INSERT INTO universo_activos (categoria, mercado, nombre, ticker, isin, divisa, tv_symbol, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [categoria, mercado, nombre, ticker, isin, divisa, tvSymbol, estado],
  });
  return Number(rs.lastInsertRowid);
}

async function actualizarActivo(id, campos) {
  const claves = Object.keys(campos);
  if (!claves.length) return;
  const set = claves.map((c) => `${c} = ?`).join(', ');
  await db.execute({
    sql: `UPDATE universo_activos SET ${set}, actualizado_en = datetime('now') WHERE id = ?`,
    args: [...claves.map((c) => campos[c]), id],
  });
}

// ---------- Configuracion ----------

async function obtenerMediasConfig() {
  const rs = await db.execute('SELECT * FROM config_medias ORDER BY posicion');
  return rs.rows.map((r) => ({ ...r, etiqueta: `${r.tipo} ${r.periodo}` }));
}

async function obtenerTimeframesConfig() {
  const rs = await db.execute('SELECT * FROM config_timeframes ORDER BY rowid');
  return rs.rows;
}

async function actualizarTimeframeConfig(timeframe, campos) {
  const claves = Object.keys(campos);
  const set = claves.map((c) => `${c} = ?`).join(', ');
  await db.execute({
    sql: `UPDATE config_timeframes SET ${set} WHERE timeframe = ?`,
    args: [...claves.map((c) => campos[c]), timeframe],
  });
}

async function obtenerConfigGeneral(clave, porDefecto) {
  const rs = await db.execute({ sql: 'SELECT valor FROM config_general WHERE clave = ?', args: [clave] });
  return rs.rows.length ? rs.rows[0].valor : porDefecto;
}

async function fijarConfigGeneral(clave, valor) {
  await db.execute({
    sql: 'INSERT INTO config_general (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    args: [clave, String(valor)],
  });
}

async function obtenerNivelesImportancia() {
  const rs = await db.execute('SELECT * FROM niveles_importancia');
  const mapa = new Map();
  rs.rows.forEach((r) => mapa.set(`${r.media_rapida}|${r.media_lenta}|${r.timeframe}`, r));
  return mapa;
}

async function listarNivelesImportancia() {
  const rs = await db.execute('SELECT * FROM niveles_importancia ORDER BY timeframe, nivel');
  return rs.rows;
}

// ---------- Alertas ----------

async function existeAlerta(id) {
  const rs = await db.execute({ sql: 'SELECT 1 FROM alertas WHERE id = ?', args: [id] });
  return rs.rows.length > 0;
}

async function insertarAlerta(a) {
  await db.execute({
    sql: `INSERT INTO alertas
      (id, activo_id, nombre_activo, mercado, timeframe, media_rapida, media_lenta, direccion, nivel, mensaje, precio_en_cruce, detectada_en, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'activa')`,
    args: [
      a.id, a.activoId, a.nombreActivo, a.mercado, a.timeframe, a.mediaRapida,
      a.mediaLenta, a.direccion, a.nivel, a.mensaje, a.precioEnCruce,
    ],
  });
}

/** Pasa a 'historico' las alertas activas con mas de 36h de antiguedad. */
async function archivarAlertasVencidas(horas = 36) {
  const rs = await db.execute({
    sql: `UPDATE alertas SET estado = 'historico'
          WHERE estado = 'activa' AND detectada_en <= datetime('now', ?)`,
    args: [`-${horas} hours`],
  });
  return rs.rowsAffected;
}

/** Activos que tienen al menos una alerta activa (son los unicos visibles en el panel). */
async function listarActivosConAlertaActiva() {
  const rs = await db.execute(`
    SELECT DISTINCT activo_id FROM alertas WHERE estado = 'activa'
  `);
  return rs.rows.map((r) => r.activo_id);
}

async function listarAlertasActivasDeActivo(activoId) {
  const rs = await db.execute({
    sql: "SELECT * FROM alertas WHERE activo_id = ? AND estado = 'activa' ORDER BY detectada_en DESC",
    args: [activoId],
  });
  return rs.rows;
}

async function listarHistorico({ limite = 200, offset = 0 } = {}) {
  const rs = await db.execute({
    sql: "SELECT * FROM alertas WHERE estado = 'historico' ORDER BY detectada_en DESC LIMIT ? OFFSET ?",
    args: [limite, offset],
  });
  return rs.rows;
}

// ---------- Snapshot (datos mostrados en el panel) ----------

async function guardarSnapshot(activoId, datos) {
  await db.execute({
    sql: `INSERT INTO snapshot_activo
      (activo_id, precio_actual, var_dia, var_5d, var_1m, var_3m, var_ytd, var_1a, var_5a, rsi, tendencias_json, distancia_medias_json, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(activo_id) DO UPDATE SET
        precio_actual = excluded.precio_actual, var_dia = excluded.var_dia, var_5d = excluded.var_5d,
        var_1m = excluded.var_1m, var_3m = excluded.var_3m, var_ytd = excluded.var_ytd,
        var_1a = excluded.var_1a, var_5a = excluded.var_5a, rsi = excluded.rsi,
        tendencias_json = excluded.tendencias_json, distancia_medias_json = excluded.distancia_medias_json,
        actualizado_en = datetime('now')`,
    args: [
      activoId, datos.precioActual, datos.varDia, datos.var5d, datos.var1m, datos.var3m,
      datos.varYtd, datos.var1a, datos.var5a, datos.rsi,
      JSON.stringify(datos.tendencias || {}), JSON.stringify(datos.distanciaMedias || []),
    ],
  });
}

async function obtenerSnapshot(activoId) {
  const rs = await db.execute({ sql: 'SELECT * FROM snapshot_activo WHERE activo_id = ?', args: [activoId] });
  return rs.rows[0] || null;
}

/** Panel completo: activos con alerta activa + su snapshot + sus alertas activas. */
async function obtenerPanelActivo() {
  const rs = await db.execute(`
    SELECT u.id, u.nombre, u.mercado, u.categoria, u.divisa,
           s.precio_actual, s.var_dia, s.var_5d, s.var_1m, s.var_3m, s.var_ytd, s.var_1a, s.var_5a,
           s.rsi, s.tendencias_json, s.distancia_medias_json, s.actualizado_en
    FROM universo_activos u
    JOIN (SELECT DISTINCT activo_id FROM alertas WHERE estado = 'activa') a ON a.activo_id = u.id
    LEFT JOIN snapshot_activo s ON s.activo_id = u.id
    ORDER BY s.actualizado_en DESC
  `);
  const activos = rs.rows;
  for (const act of activos) {
    // eslint-disable-next-line no-await-in-loop
    act.alertas = await listarAlertasActivasDeActivo(act.id);
    act.tendencias = JSON.parse(act.tendencias_json || '{}');
    act.distanciaMedias = JSON.parse(act.distancia_medias_json || '[]');
  }
  return activos;
}

// ---------- Log de ciclos ----------

async function iniciarLogCiclo() {
  const rs = await db.execute({
    sql: "INSERT INTO log_ciclos (inicio) VALUES (datetime('now'))",
  });
  return Number(rs.lastInsertRowid);
}

async function cerrarLogCiclo(id, { activosProcesados, alertasNuevas, errores }) {
  await db.execute({
    sql: `UPDATE log_ciclos SET fin = datetime('now'), activos_procesados = ?, alertas_nuevas = ?, errores = ? WHERE id = ?`,
    args: [activosProcesados, alertasNuevas, errores ? JSON.stringify(errores) : null, id],
  });
}

module.exports = {
  listarActivosActivos,
  listarTodosLosActivos,
  crearActivo,
  actualizarActivo,
  obtenerMediasConfig,
  obtenerTimeframesConfig,
  actualizarTimeframeConfig,
  obtenerConfigGeneral,
  fijarConfigGeneral,
  obtenerNivelesImportancia,
  listarNivelesImportancia,
  existeAlerta,
  insertarAlerta,
  archivarAlertasVencidas,
  listarActivosConAlertaActiva,
  listarAlertasActivasDeActivo,
  listarHistorico,
  guardarSnapshot,
  obtenerSnapshot,
  obtenerPanelActivo,
  iniciarLogCiclo,
  cerrarLogCiclo,
};

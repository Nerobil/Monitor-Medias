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

/** Da de alta o actualiza una de las 4 posiciones de config_medias (1..4). */
async function guardarMediaConfig({ posicion, tipo, periodo }) {
  await db.execute({
    sql: `INSERT INTO config_medias (posicion, tipo, periodo) VALUES (?, ?, ?)
          ON CONFLICT(posicion) DO UPDATE SET tipo = excluded.tipo, periodo = excluded.periodo`,
    args: [posicion, tipo, periodo],
  });
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

/**
 * Da de alta o actualiza una regla de cruce a vigilar. La combinacion
 * media_rapida/media_lenta/timeframe es unica: si ya existia, se actualiza
 * el nivel en vez de duplicarla.
 */
async function guardarNivelImportancia({
  mediaRapida, mediaLenta, timeframe, nivel, descripcion,
}) {
  await db.execute({
    sql: `INSERT INTO niveles_importancia (media_rapida, media_lenta, timeframe, nivel, descripcion)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(media_rapida, media_lenta, timeframe) DO UPDATE SET
            nivel = excluded.nivel, descripcion = excluded.descripcion`,
    args: [mediaRapida, mediaLenta, timeframe, nivel, descripcion || null],
  });
}

async function eliminarNivelImportancia(id) {
  const rs = await db.execute({ sql: 'DELETE FROM niveles_importancia WHERE id = ?', args: [id] });
  return rs.rowsAffected > 0;
}

// ---------- Alertas ----------

async function existeAlerta(id) {
  const rs = await db.execute({ sql: 'SELECT 1 FROM alertas WHERE id = ?', args: [id] });
  return rs.rows.length > 0;
}

async function insertarAlerta(a) {
  await db.execute({
    sql: `INSERT INTO alertas
      (id, activo_id, nombre_activo, tv_symbol, mercado, timeframe, media_rapida, media_lenta, direccion, nivel, mensaje, precio_en_cruce, detectada_en, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'activa')`,
    args: [
      a.id, a.activoId, a.nombreActivo, a.tvSymbol, a.mercado, a.timeframe, a.mediaRapida,
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

/** Borra una alerta de forma manual y definitiva, independiente del archivado automatico por antiguedad (36h). */
async function eliminarAlerta(id) {
  const rs = await db.execute({ sql: 'DELETE FROM alertas WHERE id = ?', args: [id] });
  return rs.rowsAffected > 0;
}

// ---------- Snapshot (datos mostrados en el panel) ----------

async function guardarSnapshot(activoId, datos) {
  const v = (x) => (x === undefined ? null : x);
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
      activoId, v(datos.precioActual), v(datos.varDia), v(datos.var5d), v(datos.var1m), v(datos.var3m),
      v(datos.varYtd), v(datos.var1a), v(datos.var5a), v(datos.rsi),
      JSON.stringify(datos.tendencias || {}), JSON.stringify(datos.distanciaMedias || []),
    ],
  });
}

async function obtenerSnapshot(activoId) {
  const rs = await db.execute({ sql: 'SELECT * FROM snapshot_activo WHERE activo_id = ?', args: [activoId] });
  return rs.rows[0] || null;
}

/**
 * Lista de alertas activas, mas nuevas primero, opcionalmente filtradas por
 * timeframe. Una sola consulta (con el contexto del activo - precio, RSI,
 * tendencias - incluido via LEFT JOIN), sin importar cuantos activos
 * distintos tengan alerta: evita tanto N+1 consultas como el limite de
 * peticiones salientes de Cloudflare.
 */
async function listarAlertasActivas({ timeframe } = {}) {
  const base = `
    SELECT a.id, a.activo_id, a.nombre_activo, a.tv_symbol, a.mercado, a.timeframe,
           a.media_rapida, a.media_lenta, a.direccion, a.nivel, a.mensaje,
           a.precio_en_cruce, a.detectada_en,
           s.precio_actual, s.var_dia, s.var_5d, s.var_1m, s.var_3m, s.var_ytd, s.var_1a, s.var_5a,
           s.rsi, s.tendencias_json
    FROM alertas a
    LEFT JOIN snapshot_activo s ON s.activo_id = a.activo_id
    WHERE a.estado = 'activa'`;
  const rs = timeframe
    ? await db.execute({ sql: `${base} AND a.timeframe = ? ORDER BY a.detectada_en DESC`, args: [timeframe] })
    : await db.execute(`${base} ORDER BY a.detectada_en DESC`);
  return rs.rows.map((r) => ({ ...r, tendencias: JSON.parse(r.tendencias_json || '{}') }));
}

// ---------- Log de ciclos ----------

async function iniciarLogCiclo() {
  const rs = await db.execute({
    sql: "INSERT INTO log_ciclos (inicio) VALUES (datetime('now'))",
    args: [],
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
  guardarMediaConfig,
  obtenerTimeframesConfig,
  actualizarTimeframeConfig,
  obtenerConfigGeneral,
  fijarConfigGeneral,
  obtenerNivelesImportancia,
  listarNivelesImportancia,
  guardarNivelImportancia,
  eliminarNivelImportancia,
  existeAlerta,
  insertarAlerta,
  archivarAlertasVencidas,
  listarActivosConAlertaActiva,
  listarAlertasActivasDeActivo,
  listarHistorico,
  eliminarAlerta,
  guardarSnapshot,
  obtenerSnapshot,
  listarAlertasActivas,
  iniciarLogCiclo,
  cerrarLogCiclo,
};

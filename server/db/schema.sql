-- Esquema de la base de datos del Monitor de Cruces de Medias Moviles.
-- Sustituye al libro Excel. Compatible con SQLite local y con Turso (libSQL).

-- Universo maestro de activos. Sin limite de filas: se pueden dar de alta
-- todos los activos que se quiera.
CREATE TABLE IF NOT EXISTS universo_activos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT,
  mercado TEXT,
  nombre TEXT NOT NULL,
  ticker TEXT,                 -- ticker "de negocio" (informativo, ej. ITX.MC)
  isin TEXT,
  divisa TEXT,
  tv_symbol TEXT NOT NULL,     -- simbolo exacto de TradingView, ej. BME:ITX
  estado TEXT NOT NULL DEFAULT 'Activo',  -- Activo | Inactivo
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_universo_tv_symbol ON universo_activos(tv_symbol);

-- Configuracion de las 4 medias moviles vigiladas (equivalente a C5:D8 del Excel).
CREATE TABLE IF NOT EXISTS config_medias (
  posicion INTEGER PRIMARY KEY,  -- 1..4
  tipo TEXT NOT NULL,            -- SMA | EMA | WMA | SMMA
  periodo INTEGER NOT NULL
);

-- Timeframes activos a vigilar y a mostrar en el panel (equivalente a la nueva
-- seccion de "tendencia por timeframe"). activo_vigilancia = se comprueban cruces,
-- activo_panel = se muestra su tendencia en el dashboard (se puede apagar).
CREATE TABLE IF NOT EXISTS config_timeframes (
  timeframe TEXT PRIMARY KEY,   -- '15', '30', '60', '240', '1D'
  etiqueta TEXT NOT NULL,       -- '15m', '30m', '1h', '4h', '1D'
  vigilar_cruces INTEGER NOT NULL DEFAULT 1,
  mostrar_en_panel INTEGER NOT NULL DEFAULT 1
);

-- Interruptores generales del panel (RSI on/off, etc.)
CREATE TABLE IF NOT EXISTS config_general (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Reglas de importancia: que cruce de que medias, en que timeframe, y con que nivel.
-- Solo se vigilan y notifican cruces MEDIA/MEDIA dados de alta aqui.
CREATE TABLE IF NOT EXISTS niveles_importancia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_rapida TEXT NOT NULL,   -- etiqueta, ej. 'EMA 9'
  media_lenta TEXT NOT NULL,    -- etiqueta, ej. 'EMA 21'
  timeframe TEXT NOT NULL,      -- '15', '30', '60', '240', '1D'
  nivel INTEGER NOT NULL,
  descripcion TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_niveles_regla
  ON niveles_importancia(media_rapida, media_lenta, timeframe);

-- Alertas: una fila por cruce detectado. estado = 'activa' mientras tenga menos
-- de 36h, el ciclo la pasa a 'historico' automaticamente al superarlas (no se
-- borra ni se mueve de tabla: solo cambia de estado, asi el historial es continuo).
CREATE TABLE IF NOT EXISTS alertas (
  id TEXT PRIMARY KEY,           -- Activo|TF-MA1MA2|AAAAMMDDhhmm (anti-duplicados)
  activo_id INTEGER NOT NULL REFERENCES universo_activos(id),
  nombre_activo TEXT NOT NULL,
  mercado TEXT,
  timeframe TEXT NOT NULL,
  media_rapida TEXT NOT NULL,
  media_lenta TEXT NOT NULL,
  direccion TEXT NOT NULL,       -- ALCISTA | BAJISTA
  nivel INTEGER,
  mensaje TEXT NOT NULL,
  precio_en_cruce REAL,
  detectada_en TEXT NOT NULL DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'activa'  -- activa | historico
);
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_activo ON alertas(activo_id);

-- Ultimo snapshot calculado por activo (precio, variaciones, tendencias, RSI,
-- distancia a medias). Se recalcula en cada ciclo SOLO para los activos que
-- tienen alguna alerta activa (son los unicos que se muestran en el panel).
CREATE TABLE IF NOT EXISTS snapshot_activo (
  activo_id INTEGER PRIMARY KEY REFERENCES universo_activos(id),
  precio_actual REAL,
  var_dia REAL,
  var_5d REAL,
  var_1m REAL,
  var_3m REAL,
  var_ytd REAL,
  var_1a REAL,
  var_5a REAL,
  rsi REAL,
  tendencias_json TEXT,      -- {"15":"ALCISTA","30":"LATERAL",...}
  distancia_medias_json TEXT, -- [{"etiqueta":"EMA 9","pct":1.23}, ...]
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Registro de ejecuciones del ciclo, util para depurar desde el panel.
CREATE TABLE IF NOT EXISTS log_ciclos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inicio TEXT NOT NULL,
  fin TEXT,
  activos_procesados INTEGER,
  alertas_nuevas INTEGER,
  errores TEXT
);

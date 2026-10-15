#!/usr/bin/env node
/**
 * Servidor MCP del Monitor de Cruces de Medias Moviles.
 *
 * Expone como herramientas MCP el mismo acceso a datos que usan las paginas
 * web (universo.html, niveles.html, medias.html, ajustes.html), conectando
 * DIRECTAMENTE a la base de datos de Turso - no hace falta que la web ni
 * GitHub Actions esten funcionando para usarlo.
 *
 * Variables de entorno necesarias (las mismas que ya usas en server/.env):
 *   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *
 * Uso desde Claude Desktop / Claude Code: se ejecuta como proceso local via
 * stdio (ver README.md de esta carpeta para la configuracion exacta).
 */
require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { aplicarEsquema } = require('../server/db/cliente');
const repo = require('../server/db/repositorio');
const { buscarSimboloHTTP } = require('./tvSearch');

const server = new McpServer({ name: 'monitor-cruces', version: '1.0.0' });

function textoOk(objeto) {
  return { content: [{ type: 'text', text: JSON.stringify(objeto, null, 2) }] };
}
function textoError(mensaje) {
  return { content: [{ type: 'text', text: `Error: ${mensaje}` }], isError: true };
}
function envolver(fn) {
  return async (args) => {
    try {
      return textoOk(await fn(args));
    } catch (err) {
      return textoError(err.message);
    }
  };
}

// ---------- Alertas ----------

server.registerTool(
  'listar_alertas_activas',
  {
    title: 'Listar alertas activas',
    description: 'Cruces de medias detectados en las ultimas 36 horas (lo que se ve en el panel), mas recientes primero. Incluye precio, variaciones, RSI y tendencia cuando estan disponibles.',
    inputSchema: {
      timeframe: z.enum(['15', '30', '60', '240', '1D']).optional()
        .describe('Filtra por timeframe concreto. Si se omite, devuelve todas.'),
    },
  },
  envolver(async ({ timeframe }) => {
    const alertas = await repo.listarAlertasActivas({ timeframe });
    return { total: alertas.length, alertas };
  }),
);

server.registerTool(
  'listar_historico_alertas',
  {
    title: 'Listar historico de alertas',
    description: 'Alertas ya archivadas (con mas de 36 horas), mas recientes primero, paginado.',
    inputSchema: {
      limite: z.number().int().min(1).max(500).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    },
  },
  envolver(async ({ limite, offset }) => {
    const historico = await repo.listarHistorico({ limite, offset });
    return { total: historico.length, historico };
  }),
);

server.registerTool(
  'eliminar_alerta',
  {
    title: 'Eliminar una alerta',
    description: 'Borra una alerta concreta (activa o de historico) de forma permanente, por su id.',
    inputSchema: { id: z.string() },
  },
  envolver(async ({ id }) => ({ borrada: await repo.eliminarAlerta(id) })),
);

// ---------- Universo de activos ----------

server.registerTool(
  'listar_activos',
  {
    title: 'Listar el universo de activos',
    description: 'Todos los activos dados de alta (activos e inactivos), con categoria, mercado, simbolo de TradingView y estado.',
    inputSchema: {
      soloActivos: z.boolean().optional().default(false)
        .describe('Si es true, solo devuelve los que estan en estado Activo (los que realmente se vigilan).'),
    },
  },
  envolver(async ({ soloActivos }) => {
    const activos = soloActivos ? await repo.listarActivosActivos() : await repo.listarTodosLosActivos();
    return { total: activos.length, activos };
  }),
);

server.registerTool(
  'buscar_simbolo_tradingview',
  {
    title: 'Buscar simbolo en TradingView',
    description: 'Busca por nombre o ticker en TradingView para encontrar el simbolo exacto (formato BOLSA:TICKER) antes de dar de alta un activo nuevo.',
    inputSchema: {
      texto: z.string().describe('Nombre o ticker a buscar, ej. "Inditex" o "AAPL"'),
      tipo: z.enum(['stock', 'futures', 'forex', 'crypto', 'index', 'cfd', '']).optional().default(''),
    },
  },
  envolver(async ({ texto, tipo }) => ({ resultados: await buscarSimboloHTTP(texto, tipo) })),
);

server.registerTool(
  'dar_alta_activo',
  {
    title: 'Dar de alta un activo nuevo',
    description: 'Anade un activo al universo vigilado. Usa buscar_simbolo_tradingview antes para conseguir el tvSymbol exacto - un simbolo incorrecto vigilaria el activo equivocado.',
    inputSchema: {
      nombre: z.string(),
      tvSymbol: z.string().describe('Simbolo exacto de TradingView, formato BOLSA:TICKER, ej. "NASDAQ:AAPL"'),
      categoria: z.string().optional(),
      mercado: z.string().optional(),
      ticker: z.string().optional(),
      isin: z.string().optional(),
      divisa: z.string().optional(),
    },
  },
  envolver(async (datos) => ({ id: await repo.crearActivo({ ...datos, estado: 'Activo' }), creado: true })),
);

server.registerTool(
  'activar_desactivar_activo',
  {
    title: 'Activar o desactivar un activo',
    description: 'Cambia el estado de un activo sin borrarlo - sigue en la lista y se puede reactivar despues. Mientras este Inactivo, el ciclo de vigilancia lo ignora.',
    inputSchema: { id: z.number().int(), activo: z.boolean().describe('true para Activo, false para Inactivo') },
  },
  envolver(async ({ id, activo }) => {
    await repo.actualizarActivo(id, { estado: activo ? 'Activo' : 'Inactivo' });
    return { ok: true };
  }),
);

// ---------- Niveles de importancia (reglas de cruce) ----------

server.registerTool(
  'listar_niveles_importancia',
  {
    title: 'Listar reglas de cruce (Niveles de Importancia)',
    description: 'Todas las reglas de cruce Media/Media dadas de alta, activas e inactivas. Solo las activas generan avisos.',
    inputSchema: {},
  },
  envolver(async () => {
    const niveles = await repo.listarTodosLosNiveles();
    return { total: niveles.length, niveles };
  }),
);

server.registerTool(
  'crear_nivel_importancia',
  {
    title: 'Dar de alta o actualizar una regla de cruce',
    description: 'Da de alta una regla nueva, o actualiza el nivel de una ya existente (misma combinacion mediaRapida/mediaLenta/timeframe). Las medias se escriben como "TIPO PERIODO", ej. "EMA 9". Tipos admitidos: SMA, EMA, WMA, SMMA.',
    inputSchema: {
      mediaRapida: z.string().regex(/^[A-Za-z]+ \d+$/, 'Formato esperado: "TIPO PERIODO", ej. "EMA 9"'),
      mediaLenta: z.string().regex(/^[A-Za-z]+ \d+$/, 'Formato esperado: "TIPO PERIODO", ej. "SMA 200"'),
      timeframe: z.enum(['15', '30', '60', '240', '1D']),
      nivel: z.number().int().min(1),
      descripcion: z.string().optional(),
    },
  },
  envolver(async (datos) => {
    await repo.guardarNivelImportancia(datos);
    return { ok: true };
  }),
);

server.registerTool(
  'activar_desactivar_nivel_importancia',
  {
    title: 'Activar o desactivar una regla de cruce',
    description: 'Apaga o enciende una regla sin borrarla. Mientras este desactivada, ese cruce no genera avisos.',
    inputSchema: { id: z.number().int(), activo: z.boolean() },
  },
  envolver(async ({ id, activo }) => {
    await repo.actualizarEstadoNivel(id, activo);
    return { ok: true };
  }),
);

server.registerTool(
  'eliminar_nivel_importancia',
  {
    title: 'Borrar una regla de cruce',
    description: 'Elimina definitivamente una regla de Niveles de Importancia.',
    inputSchema: { id: z.number().int() },
  },
  envolver(async ({ id }) => ({ borrada: await repo.eliminarNivelImportancia(id) })),
);

// ---------- Medias de referencia (tendencia del panel) ----------

server.registerTool(
  'obtener_medias_config',
  {
    title: 'Ver las medias de referencia',
    description: 'Las 4 posiciones de config_medias. La 1 (rapida) y la 2 (lenta) calculan la tendencia que se ve en el panel; 3 y 4 estan reservadas.',
    inputSchema: {},
  },
  envolver(async () => ({ medias: await repo.obtenerMediasConfig() })),
);

server.registerTool(
  'actualizar_media_config',
  {
    title: 'Cambiar una media de referencia',
    description: 'Actualiza el tipo y periodo de una de las 4 posiciones de config_medias.',
    inputSchema: {
      posicion: z.number().int().min(1).max(4),
      tipo: z.enum(['SMA', 'EMA', 'WMA', 'SMMA']),
      periodo: z.number().int().min(1),
    },
  },
  envolver(async (datos) => {
    await repo.guardarMediaConfig(datos);
    return { ok: true };
  }),
);

// ---------- Ajustes: timeframes vigilados y canales de notificacion ----------

server.registerTool(
  'obtener_ajustes',
  {
    title: 'Ver ajustes generales',
    description: 'Timeframes configurados (vigilar cruces / mostrar tendencia), si el RSI se muestra en el panel, y si Telegram/Email estan activos.',
    inputSchema: {},
  },
  envolver(async () => ({
    timeframes: await repo.obtenerTimeframesConfig(),
    mostrarRsi: (await repo.obtenerConfigGeneral('mostrar_rsi', 'true')) === 'true',
    canalTelegram: (await repo.obtenerConfigGeneral('canal_telegram', 'true')) === 'true',
    canalEmail: (await repo.obtenerConfigGeneral('canal_email', 'true')) === 'true',
  })),
);

server.registerTool(
  'actualizar_timeframe',
  {
    title: 'Activar/desactivar un timeframe',
    description: '"vigilarCruces" en false deja de generar avisos para ese timeframe (sin borrar sus reglas). "mostrarEnPanel" en false lo quita solo de la fila de tendencias del panel.',
    inputSchema: {
      timeframe: z.enum(['15', '30', '60', '240', '1D']),
      vigilarCruces: z.boolean().optional(),
      mostrarEnPanel: z.boolean().optional(),
    },
  },
  envolver(async ({ timeframe, vigilarCruces, mostrarEnPanel }) => {
    const campos = {};
    if (vigilarCruces !== undefined) campos.vigilar_cruces = vigilarCruces ? 1 : 0;
    if (mostrarEnPanel !== undefined) campos.mostrar_en_panel = mostrarEnPanel ? 1 : 0;
    await repo.actualizarTimeframeConfig(timeframe, campos);
    return { ok: true };
  }),
);

server.registerTool(
  'actualizar_canal_notificacion',
  {
    title: 'Activar/desactivar Telegram o Email',
    description: 'Enciende o apaga un canal de notificacion. Las credenciales (token, SMTP) siguen viviendo en GitHub Secrets, esto solo enciende/apaga el canal.',
    inputSchema: { canal: z.enum(['telegram', 'email']), activo: z.boolean() },
  },
  envolver(async ({ canal, activo }) => {
    await repo.fijarConfigGeneral(`canal_${canal}`, activo ? 'true' : 'false');
    return { ok: true };
  }),
);

server.registerTool(
  'actualizar_rsi_panel',
  {
    title: 'Mostrar/ocultar el RSI en el panel',
    inputSchema: { activo: z.boolean() },
  },
  envolver(async ({ activo }) => {
    await repo.fijarConfigGeneral('mostrar_rsi', activo ? 'true' : 'false');
    return { ok: true };
  }),
);

async function main() {
  await aplicarEsquema();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP "monitor-cruces" listo (stdio).');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fallo arrancando el servidor MCP:', err);
    process.exit(1);
  });
}

module.exports = { server, main };

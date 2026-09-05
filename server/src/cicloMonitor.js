require('dotenv').config();
const { aplicarEsquema } = require('../db/cliente');
const repo = require('../db/repositorio');
const {
  calcularMedia, rsi, parseEtiquetaMedia,
} = require('./indicadores');
const { calcularVariaciones } = require('./variacion');
const { clasificarTendencia } = require('./tendencia');
const { detectarCruce } = require('./crossDetector');
const { construirMensaje, construirId, etiquetaTimeframe } = require('./importancia');
const { obtenerVelas, crearCliente } = require('./tvFetcher');
const { despacharAvisos } = require('./notificadores');

const HORAS_VENTANA_ACTIVA = 36;
const PAUSA_ENTRE_ACTIVOS_MS = Number(process.env.PAUSA_ENTRE_ACTIVOS_MS || 400);

function log(msg) {
  console.log(`[${new Date().toLocaleString('es-ES')}] ${msg}`);
}

function pctDistancia(precio, media) {
  if (media === null || media === undefined || !Number.isFinite(media)) return null;
  return ((precio - media) / media) * 100;
}

function esperar(ms) {
  return new Promise((r) => { setTimeout(r, ms); });
}

/**
 * Procesa un activo: descarga velas, calcula variaciones/RSI/tendencias,
 * evalua las reglas de niveles_importancia que le correspondan y devuelve
 * las alertas nuevas detectadas (si las hay).
 */
async function procesarActivo({
  client, activo, reglas, timeframesConfig, maTendenciaRapida, maTendenciaLenta,
}) {
  const velasDiarias = await obtenerVelas(client, activo.tv_symbol, '1D', 1300);
  const cierresDiarios = velasDiarias.map((v) => v.close);
  const precioActual = cierresDiarios[cierresDiarios.length - 1];
  const variaciones = calcularVariaciones(velasDiarias);
  const rsiValor = rsi(cierresDiarios, 14);

  const velasPorTF = { '1D': velasDiarias };
  for (const tf of timeframesConfig) {
    if (tf.timeframe === '1D') continue;
    if (!tf.vigilar_cruces && !tf.mostrar_en_panel) continue;
    // eslint-disable-next-line no-await-in-loop
    velasPorTF[tf.timeframe] = await obtenerVelas(client, activo.tv_symbol, tf.timeframe, 300);
  }

  const tendencias = {};
  timeframesConfig.forEach((tf) => {
    if (!tf.mostrar_en_panel) return;
    const velas = velasPorTF[tf.timeframe];
    if (!velas) return;
    tendencias[tf.timeframe] = clasificarTendencia(
      velas.map((v) => v.close), maTendenciaRapida, maTendenciaLenta,
    );
  });

  const tfConVigilancia = new Set(
    timeframesConfig.filter((t) => t.vigilar_cruces).map((t) => String(t.timeframe)),
  );
  const alertasNuevas = [];
  const distanciaMedias = [];

  for (const regla of reglas) {
    if (!tfConVigilancia.has(String(regla.timeframe))) continue;
    const velas = velasPorTF[regla.timeframe];
    if (!velas || velas.length < 5) continue;
    const cierres = velas.map((v) => v.close);

    const rapida = parseEtiquetaMedia(regla.media_rapida);
    const lenta = parseEtiquetaMedia(regla.media_lenta);
    const serieRapida = calcularMedia(cierres, rapida.tipo, rapida.periodo);
    const serieLenta = calcularMedia(cierres, lenta.tipo, lenta.periodo);
    const i = cierres.length - 1;

    const direccion = detectarCruce(serieRapida[i], serieRapida[i - 1], serieLenta[i], serieLenta[i - 1]);

    const tfEtq = etiquetaTimeframe(regla.timeframe);
    if (serieRapida[i] !== null) {
      distanciaMedias.push({ etiqueta: `${regla.media_rapida} (${tfEtq})`, pct: pctDistancia(precioActual, serieRapida[i]) });
    }
    if (serieLenta[i] !== null) {
      distanciaMedias.push({ etiqueta: `${regla.media_lenta} (${tfEtq})`, pct: pctDistancia(precioActual, serieLenta[i]) });
    }

    if (direccion) {
      const id = construirId(activo.nombre, regla.timeframe, regla.media_rapida, regla.media_lenta, velas[i].time);
      // eslint-disable-next-line no-await-in-loop
      const yaExiste = await repo.existeAlerta(id);
      if (!yaExiste) {
        const mensaje = construirMensaje({
          direccion,
          mediaRapida: regla.media_rapida,
          mediaLenta: regla.media_lenta,
          timeframe: regla.timeframe,
          nombreActivo: activo.nombre,
          mercado: activo.mercado,
          nivel: regla.nivel,
          precio: precioActual,
        });
        const alerta = {
          id,
          activoId: activo.id,
          nombreActivo: activo.nombre,
          mercado: activo.mercado,
          timeframe: regla.timeframe,
          mediaRapida: regla.media_rapida,
          mediaLenta: regla.media_lenta,
          direccion,
          nivel: regla.nivel,
          mensaje,
          precioEnCruce: precioActual,
        };
        // eslint-disable-next-line no-await-in-loop
        await repo.insertarAlerta(alerta);
        alertasNuevas.push(alerta);
      }
    }
  }

  return {
    alertasNuevas,
    snapshot: {
      precioActual,
      varDia: variaciones.varDia,
      var5d: variaciones.var5d,
      var1m: variaciones.var1m,
      var3m: variaciones.var3m,
      varYtd: variaciones.varYtd,
      var1a: variaciones.var1a,
      var5a: variaciones.var5a,
      rsi: rsiValor,
      tendencias,
      distanciaMedias,
    },
  };
}

async function ejecutarCiclo() {
  await aplicarEsquema();
  const idLog = await repo.iniciarLogCiclo();
  log('Ciclo iniciado.');

  const activos = await repo.listarActivosActivos();
  const reglas = await repo.listarNivelesImportancia();
  const timeframesConfig = await repo.obtenerTimeframesConfig();
  const mediasConfig = await repo.obtenerMediasConfig();
  const maTendenciaRapida = mediasConfig.find((m) => m.posicion === 1) || { tipo: 'EMA', periodo: 9 };
  const maTendenciaLenta = mediasConfig.find((m) => m.posicion === 2) || { tipo: 'EMA', periodo: 21 };

  log(`Activos a vigilar: ${activos.length}. Reglas de cruce dadas de alta: ${reglas.length}.`);

  const client = crearCliente();
  const alertasNuevasTotal = [];
  const errores = [];

  for (const activo of activos) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { alertasNuevas, snapshot } = await procesarActivo({
        client, activo, reglas, timeframesConfig, maTendenciaRapida, maTendenciaLenta,
      });
      alertasNuevasTotal.push(...alertasNuevas);

      // eslint-disable-next-line no-await-in-loop
      const activasPrevias = await repo.listarAlertasActivasDeActivo(activo.id);
      if (alertasNuevas.length > 0 || activasPrevias.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await repo.guardarSnapshot(activo.id, snapshot);
      }
    } catch (err) {
      errores.push({ activo: activo.nombre, error: err.message });
      log(`ERROR con ${activo.nombre}: ${err.message}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await esperar(PAUSA_ENTRE_ACTIVOS_MS);
  }

  client.end();

  const archivadas = await repo.archivarAlertasVencidas(HORAS_VENTANA_ACTIVA);
  if (archivadas) log(`Alertas pasadas a historico por antiguedad (>${HORAS_VENTANA_ACTIVA}h): ${archivadas}.`);

  if (alertasNuevasTotal.length) {
    log(`Cruces nuevos detectados: ${alertasNuevasTotal.length}. Enviando notificaciones...`);
    const { enviados, errores: erroresEnvio } = await despacharAvisos(alertasNuevasTotal);
    log(`Notificado por: ${enviados.join(', ') || 'ningun canal activo'}.`);
    erroresEnvio.forEach((e) => log(`ERROR notificando por ${e.canal}: ${e.error}`));
  } else {
    log('No hay cruces nuevos en este ciclo.');
  }

  await repo.cerrarLogCiclo(idLog, {
    activosProcesados: activos.length, alertasNuevas: alertasNuevasTotal.length, errores,
  });
  log('Ciclo finalizado.');
}

async function main() {
  // En CI (GitHub Actions, o cualquier runner que exporte CI=true) SIEMPRE se
  // ejecuta un unico ciclo y se sale, sin importar INTERVALO_MINUTOS: es el
  // cron del workflow quien decide la periodicidad. Esto evita que un .env
  // de pruebas (con INTERVALO_MINUTOS=15) deje el job en bucle hasta que lo
  // cancele el timeout del workflow.
  const enCI = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';
  const intervaloMin = enCI ? 0 : Number(process.env.INTERVALO_MINUTOS || 0);

  if (!intervaloMin) {
    await ejecutarCiclo();
    return;
  }
  log(`Modo continuo: se ejecutara cada ${intervaloMin} minutos.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ejecutarCiclo();
    } catch (err) {
      log(`ERROR en el ciclo: ${err.message}`);
      console.error(err);
    }
    // eslint-disable-next-line no-await-in-loop
    await esperar(intervaloMin * 60 * 1000);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ejecutarCiclo };

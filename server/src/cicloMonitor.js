require('dotenv').config();
const { aplicarEsquema } = require('../db/cliente');
const repo = require('../db/repositorio');
const {
  calcularMedia, rsi, parseEtiquetaMedia,
} = require('./indicadores');
const { calcularVariaciones } = require('./variacion');
const { clasificarTendencia } = require('./tendencia');
const { detectarCruce } = require('./crossDetector');
const { construirMensaje, construirId } = require('./importancia');
const { obtenerVelas, crearCliente } = require('./tvFetcher');
const { despacharAvisos } = require('./notificadores');

const HORAS_VENTANA_ACTIVA = 36;
const PAUSA_ENTRE_ACTIVOS_MS = Number(process.env.PAUSA_ENTRE_ACTIVOS_MS || 150);

function log(msg) {
  console.log(`[${new Date().toLocaleString('es-ES')}] ${msg}`);
}

function esperar(ms) {
  return new Promise((r) => { setTimeout(r, ms); });
}

/**
 * FASE 1 (barata, se hace para los N activos): descarga SOLO las velas de
 * los timeframes que de verdad usa alguna regla de niveles_importancia -
 * nunca las 5 franjas por sistema - y evalua los cruces.
 */
async function evaluarCruces({
  client, activo, reglas, reglasInvalidasAvisadas,
}) {
  const timeframesNecesarios = [...new Set(reglas.map((r) => String(r.timeframe)))];
  const velasPorTF = {};
  for (const tf of timeframesNecesarios) {
    // eslint-disable-next-line no-await-in-loop
    velasPorTF[tf] = await obtenerVelas(client, activo.tv_symbol, tf, 300);
  }

  const alertasNuevas = [];

  for (const regla of reglas) {
    const velas = velasPorTF[String(regla.timeframe)];
    if (!velas || velas.length < 5) continue;

    // Una regla mal formada (por ejemplo, con "Vela" en vez de una media
    // real - dato corrupto, no un cruce Vela/Media soportado) NUNCA debe
    // impedir evaluar el resto de reglas de este activo, ni las de los demas
    // activos. Se avisa una sola vez por regla en todo el ciclo, no una vez
    // por cada activo, para no inundar el log.
    try {
      const cierres = velas.map((v) => v.close);
      const precioActual = cierres[cierres.length - 1];

      const rapida = parseEtiquetaMedia(regla.media_rapida);
      const lenta = parseEtiquetaMedia(regla.media_lenta);
      const serieRapida = calcularMedia(cierres, rapida.tipo, rapida.periodo);
      const serieLenta = calcularMedia(cierres, lenta.tipo, lenta.periodo);
      const i = cierres.length - 1;

      const direccion = detectarCruce(serieRapida[i], serieRapida[i - 1], serieLenta[i], serieLenta[i - 1]);

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
            tvSymbol: activo.tv_symbol,
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
    } catch (errRegla) {
      const claveRegla = `${regla.media_rapida}|${regla.media_lenta}|${regla.timeframe}`;
      if (!reglasInvalidasAvisadas.has(claveRegla)) {
        reglasInvalidasAvisadas.add(claveRegla);
        log(`AVISO: la regla "${regla.media_rapida}" / "${regla.media_lenta}" (${regla.timeframe}) es invalida y se ignora en todo el ciclo: ${errRegla.message}`);
      }
    }
  }

  return { alertasNuevas, velasPorTF };
}

/**
 * FASE 2 (cara: historico diario de 1300 velas + timeframes adicionales para
 * tendencias), SOLO para los activos que van a mostrarse en el panel - es
 * decir, los que tienen alguna alerta activa (nueva o de antes). Reutiliza
 * las velas ya descargadas en la fase 1 para no pedirlas dos veces.
 */
async function calcularContextoPanel({
  client, activo, timeframesConfig, maTendenciaRapida, maTendenciaLenta, velasPorTFYaObtenidas,
}) {
  const velasDiarias = await obtenerVelas(client, activo.tv_symbol, '1D', 1300);
  const cierresDiarios = velasDiarias.map((v) => v.close);
  const variaciones = calcularVariaciones(velasDiarias);
  const rsiValor = rsi(cierresDiarios, 14);

  const velasPorTF = { ...velasPorTFYaObtenidas, '1D': velasDiarias };
  for (const tf of timeframesConfig) {
    if (tf.timeframe === '1D' || !tf.mostrar_en_panel || velasPorTF[tf.timeframe]) continue;
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

  return {
    precioActual: cierresDiarios[cierresDiarios.length - 1],
    varDia: variaciones.varDia,
    var5d: variaciones.var5d,
    var1m: variaciones.var1m,
    var3m: variaciones.var3m,
    varYtd: variaciones.varYtd,
    var1a: variaciones.var1a,
    var5a: variaciones.var5a,
    rsi: rsiValor,
    tendencias,
  };
}

/**
 * Procesa una lista de items con un maximo de `concurrencia` a la vez (en
 * vez de uno detras de otro). Como esperar la respuesta de TradingView es
 * tiempo "muerto" de red, hacer varias peticiones a la vez aprovecha ese
 * tiempo en vez de desperdiciarlo - es la optimizacion de mayor impacto,
 * pero tambien la de mas riesgo (muchas conexiones simultaneas podrian
 * activar algun limite de TradingView), por eso el valor por defecto es
 * conservador y ajustable por variable de entorno.
 */
async function procesarEnParalelo(items, concurrencia, fn) {
  let indice = 0;
  async function trabajador() {
    while (indice < items.length) {
      const miIndice = indice;
      indice += 1;
      // eslint-disable-next-line no-await-in-loop
      await fn(items[miIndice], miIndice);
    }
  }
  const trabajadores = Array.from({ length: Math.min(concurrencia, items.length) }, () => trabajador());
  await Promise.all(trabajadores);
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

  const alertasNuevasTotal = [];
  const reglasInvalidasAvisadas = new Set();
  const errores = [];
  let conContextoPanel = 0;

  if (activos.length > 0) {
    const client = crearCliente();
    const concurrencia = Number(process.env.CONCURRENCIA_ACTIVOS || 4);

    await procesarEnParalelo(activos, concurrencia, async (activo) => {
      try {
        const { alertasNuevas, velasPorTF } = await evaluarCruces({
          client, activo, reglas, reglasInvalidasAvisadas,
        });
        alertasNuevasTotal.push(...alertasNuevas);

        const activasPrevias = await repo.listarAlertasActivasDeActivo(activo.id);
        if (alertasNuevas.length > 0 || activasPrevias.length > 0) {
          conContextoPanel += 1;
          const snapshot = await calcularContextoPanel({
            client, activo, timeframesConfig, maTendenciaRapida, maTendenciaLenta, velasPorTFYaObtenidas: velasPorTF,
          });
          await repo.guardarSnapshot(activo.id, snapshot);
        }
      } catch (err) {
        errores.push({ activo: activo.nombre, error: err.message });
        log(`ERROR con ${activo.nombre}: ${err.message}`);
      }
      await esperar(PAUSA_ENTRE_ACTIVOS_MS);
    });

    log(`Contexto de panel (precio/variaciones/RSI/tendencias) calculado para ${conContextoPanel} de ${activos.length} activos (solo los que tienen alerta activa).`);

    // client.end() de la libreria de TradingView tiene un fallo conocido: si el
    // WebSocket todavia esta conectando (readyState 0) cuando se llama, nunca
    // cierra el socket porque comprueba "if (readyState)" en vez de comparar el
    // estado exacto - y 0 es "falso" en JS. Con muchos activos esto no se nota
    // (el socket ya lleva rato abierto), pero con pocos o ninguno el ciclo
    // termina tan rapido que puede pillar el WebSocket aun conectando, dejando
    // el proceso colgado para siempre. Lo evitamos esperando a que salga de
    // CONNECTING antes de pedirle que cierre, con un margen de seguridad.
    for (let i = 0; i < 50 && !client.isOpen; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await esperar(100);
    }
    try {
      await client.end();
    } catch (err) {
      log(`Aviso: no se pudo cerrar limpiamente la conexion a TradingView (${err.message}).`);
    }
  }

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
    // Salida explicita: nunca confiamos en que el bucle de eventos se vacie
    // solo. Cualquier libreria (TradingView, el cliente HTTP de Turso...)
    // puede dejar una conexion abierta de fondo sin que sea un error nuestro;
    // en un script de "ejecutar una vez y salir" como este, forzar la salida
    // aqui es la forma correcta y estandar de garantizar que el proceso
    // termina, en vez de esperar (y a veces colgarse para siempre).
    process.exit(0);
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

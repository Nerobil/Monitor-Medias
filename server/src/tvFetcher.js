const TradingView = require('@mathieuc/tradingview');

/**
 * Timeframes soportados. La clave es el codigo que usamos en toda la app
 * (BD, reglas, API); el valor es el codigo que espera la libreria de TradingView.
 */
const TIMEFRAMES = {
  15: '15',
  30: '30',
  60: '60',
  240: '240',
  '1D': 'D',
};

/**
 * Descarga las ultimas `range` velas cerradas de un simbolo/timeframe.
 * @returns {Promise<{time:number, close:number}[]>} antiguo -> reciente
 */
function obtenerVelas(client, simbolo, timeframeCodigo, range = 300) {
  const timeframe = TIMEFRAMES[timeframeCodigo];
  if (!timeframe) throw new Error(`Timeframe no soportado: ${timeframeCodigo}`);

  return new Promise((resolve, reject) => {
    const chart = new client.Session.Chart();
    let resuelto = false;
    const timeout = setTimeout(() => {
      if (!resuelto) {
        resuelto = true;
        chart.delete();
        reject(new Error(`Timeout esperando datos de ${simbolo} (${timeframeCodigo})`));
      }
    }, 20000);

    chart.onError((...err) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timeout);
      chart.delete();
      reject(new Error(`Error TradingView (${simbolo}): ${err.join(' ')}`));
    });

    chart.setMarket(simbolo, { timeframe, range });

    chart.onUpdate(() => {
      if (resuelto) return;
      if (chart.periods.length >= Math.min(range, 50)) {
        resuelto = true;
        clearTimeout(timeout);
        const ordenados = [...chart.periods]
          .sort((a, b) => a.time - b.time)
          .map((p) => ({ time: p.time, close: p.close }));
        chart.delete();
        resolve(ordenados);
      }
    });
  });
}

/**
 * Crea un cliente TradingView. Si hay TV_SESSION/TV_SIGNATURE en el entorno,
 * se conecta autenticado (necesario para algunos simbolos/indicadores premium).
 */
function crearCliente() {
  const { TV_SESSION, TV_SIGNATURE } = process.env;
  if (TV_SESSION && TV_SIGNATURE) {
    return new TradingView.Client({ token: TV_SESSION, signature: TV_SIGNATURE });
  }
  return new TradingView.Client();
}

/**
 * Busca simbolos en TradingView por texto libre (nombre, ticker...) para el
 * autocompletado de Universo_Activos. Devuelve resultados listos para mostrar
 * y para rellenar el alta de un activo.
 * @param {string} texto
 * @param {'stock'|'futures'|'forex'|'cfd'|'crypto'|'index'|'economic'|''} filtro
 */
async function buscarSimbolo(texto, filtro = '') {
  const resultados = await TradingView.searchMarketV3(texto, filtro);
  return resultados.map((r) => ({
    tvSymbol: r.id,
    mercado: r.fullExchange,
    nombre: (r.description || '').replace(/<\/?em>/g, ''),
    categoria: r.type,
    ticker: r.symbol,
  }));
}

module.exports = {
  obtenerVelas, crearCliente, buscarSimbolo, TIMEFRAMES,
};

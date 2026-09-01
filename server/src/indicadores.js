/**
 * Calculo de medias moviles sobre un array de cierres [antiguo...reciente].
 * Reproduce exactamente las formulas de la seccion 7 de la especificacion:
 * SMA = promedio simple, EMA = recursiva con factor 2/(N+1),
 * WMA = ponderada linealmente, SMMA/RMA = recursiva con factor 1/N.
 *
 * Cada funcion devuelve un array alineado con `cierres`, con `null` en las
 * posiciones donde todavia no hay suficiente historico para calcular.
 */

function sma(cierres, periodo) {
  const out = new Array(cierres.length).fill(null);
  for (let i = periodo - 1; i < cierres.length; i += 1) {
    let suma = 0;
    for (let j = i - periodo + 1; j <= i; j += 1) suma += cierres[j];
    out[i] = suma / periodo;
  }
  return out;
}

function ema(cierres, periodo) {
  const out = new Array(cierres.length).fill(null);
  if (cierres.length < periodo) return out;
  const factor = 2 / (periodo + 1);
  // La primera EMA de la serie se inicializa como una SMA (seccion 7)
  let semilla = 0;
  for (let j = 0; j < periodo; j += 1) semilla += cierres[j];
  semilla /= periodo;
  out[periodo - 1] = semilla;
  for (let i = periodo; i < cierres.length; i += 1) {
    out[i] = (cierres[i] - out[i - 1]) * factor + out[i - 1];
  }
  return out;
}

function wma(cierres, periodo) {
  const out = new Array(cierres.length).fill(null);
  const pesoTotal = (periodo * (periodo + 1)) / 2;
  for (let i = periodo - 1; i < cierres.length; i += 1) {
    let suma = 0;
    let peso = periodo;
    for (let j = i - periodo + 1; j <= i; j += 1) {
      suma += cierres[j] * peso;
      peso -= 1;
    }
    out[i] = suma / pesoTotal;
  }
  return out;
}

function smma(cierres, periodo) {
  const out = new Array(cierres.length).fill(null);
  if (cierres.length < periodo) return out;
  let semilla = 0;
  for (let j = 0; j < periodo; j += 1) semilla += cierres[j];
  semilla /= periodo;
  out[periodo - 1] = semilla;
  for (let i = periodo; i < cierres.length; i += 1) {
    out[i] = (out[i - 1] * (periodo - 1) + cierres[i]) / periodo;
  }
  return out;
}

const CALCULADORAS = {
  SMA: sma, EMA: ema, WMA: wma, SMMA: smma,
};

/**
 * Calcula una media segun su tipo (SMA/EMA/WMA/SMMA) y periodo.
 * @param {number[]} cierres array ordenado de antiguo a reciente
 * @param {string} tipo SMA | EMA | WMA | SMMA
 * @param {number} periodo
 * @returns {(number|null)[]}
 */
function calcularMedia(cierres, tipo, periodo) {
  const fn = CALCULADORAS[tipo.toUpperCase()];
  if (!fn) throw new Error(`Tipo de media no soportado: ${tipo}`);
  return fn(cierres, periodo);
}

/**
 * RSI de Wilder (el mismo metodo que usa TradingView por defecto), periodo 14
 * salvo que se indique otro. Devuelve el ultimo valor (0-100) o null si no hay
 * historico suficiente.
 * @param {number[]} cierres array ordenado de antiguo a reciente
 * @param {number} periodo
 * @returns {number|null}
 */
function rsi(cierres, periodo = 14) {
  if (cierres.length < periodo + 1) return null;
  let gananciaMedia = 0;
  let perdidaMedia = 0;
  for (let i = 1; i <= periodo; i += 1) {
    const delta = cierres[i] - cierres[i - 1];
    if (delta >= 0) gananciaMedia += delta;
    else perdidaMedia += -delta;
  }
  gananciaMedia /= periodo;
  perdidaMedia /= periodo;
  for (let i = periodo + 1; i < cierres.length; i += 1) {
    const delta = cierres[i] - cierres[i - 1];
    const ganancia = delta > 0 ? delta : 0;
    const perdida = delta < 0 ? -delta : 0;
    gananciaMedia = (gananciaMedia * (periodo - 1) + ganancia) / periodo;
    perdidaMedia = (perdidaMedia * (periodo - 1) + perdida) / periodo;
  }
  if (perdidaMedia === 0) return 100;
  const rs = gananciaMedia / perdidaMedia;
  return 100 - (100 / (1 + rs));
}

/**
 * Convierte una etiqueta de media ("EMA 9", "SMA 200"...) tal como se escribe
 * en niveles_importancia a {tipo, periodo}.
 */
function parseEtiquetaMedia(etiqueta) {
  const m = /^([A-Za-z]+)\s+(\d+)$/.exec(String(etiqueta).trim());
  if (!m) throw new Error(`Etiqueta de media invalida: "${etiqueta}" (formato esperado "EMA 9")`);
  return { tipo: m[1].toUpperCase(), periodo: Number(m[2]) };
}

module.exports = {
  calcularMedia, sma, ema, wma, smma, rsi, parseEtiquetaMedia,
};

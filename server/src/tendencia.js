const { calcularMedia } = require('./indicadores');

/**
 * Clasifica la tendencia de una serie de cierres usando el cruce de medias
 * rapida/lenta configuradas (MA1/MA2) mas la posicion del precio:
 *  - ALCISTA: precio > MA1 > MA2
 *  - BAJISTA: precio < MA1 < MA2
 *  - LATERAL: cualquier otra combinacion (medias entrelazadas / sin orden claro)
 *
 * @param {number[]} cierres antiguo -> reciente
 * @param {{tipo:string, periodo:number}} maRapida
 * @param {{tipo:string, periodo:number}} maLenta
 * @returns {'ALCISTA'|'BAJISTA'|'LATERAL'|null}
 */
function clasificarTendencia(cierres, maRapida, maLenta) {
  if (cierres.length < Math.max(maRapida.periodo, maLenta.periodo) + 1) return null;
  const serieRapida = calcularMedia(cierres, maRapida.tipo, maRapida.periodo);
  const serieLenta = calcularMedia(cierres, maLenta.tipo, maLenta.periodo);
  const i = cierres.length - 1;
  const precio = cierres[i];
  const rapida = serieRapida[i];
  const lenta = serieLenta[i];
  if (rapida === null || lenta === null) return null;

  if (precio > rapida && rapida > lenta) return 'ALCISTA';
  if (precio < rapida && rapida < lenta) return 'BAJISTA';
  return 'LATERAL';
}

module.exports = { clasificarTendencia };

/**
 * Reproduce las formulas de cruce de la hoja Monitorizacion (seccion 8 de la
 * especificacion), usando el valor actual y anterior de cada serie.
 *
 * Cruce Vela/MA:  ALCISTA si (cierre_ant <= media_ant) y (cierre_act > media_act)
 *                 BAJISTA si (cierre_ant >= media_ant) y (cierre_act < media_act)
 * Cruce MAi/MAj:  misma logica sustituyendo la vela por la media rapida
 */
function detectarCruce(actualA, anteriorA, actualB, anteriorB) {
  if ([actualA, anteriorA, actualB, anteriorB].some((v) => v === null || v === undefined)) {
    return '';
  }
  if (anteriorA <= anteriorB && actualA > actualB) return 'ALCISTA';
  if (anteriorA >= anteriorB && actualA < actualB) return 'BAJISTA';
  return '';
}

module.exports = { detectarCruce };

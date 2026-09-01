/**
 * Busca la regla exacta media_rapida/media_lenta/timeframe en el mapa cargado
 * de niveles_importancia. Si un cruce no tiene regla dada de alta, NO se
 * considera una alerta (se ignora por completo, ver cicloMonitor.js).
 * @param {Map<string, {nivel:number, descripcion?:string}>} reglas
 */
function buscarRegla(reglas, mediaRapida, mediaLenta, timeframe) {
  return reglas.get(`${mediaRapida}|${mediaLenta}|${timeframe}`) || null;
}

function etiquetaTimeframe(timeframe) {
  return { 15: '15 min', 30: '30 min', 60: '1 hora', 240: '4 horas', '1D': 'Diario' }[timeframe] || timeframe;
}

/**
 * Construye el mensaje de aviso para un cruce Media/Media.
 */
function construirMensaje({
  direccion, mediaRapida, mediaLenta, timeframe, nombreActivo, mercado, nivel, precio,
}) {
  const fecha = new Date().toLocaleString('es-ES');
  const tf = etiquetaTimeframe(timeframe);
  const dir = direccion.toLowerCase();
  return `Cruce ${dir} detectado en ${nombreActivo} (${mercado}). ${mediaRapida} ha cruzado ${mediaLenta} en ${tf}. Nivel ${nivel}. Precio: ${Number(precio).toFixed(2)}. ${fecha}`;
}

/**
 * ID unico anti-duplicados: Activo|TF-MediaRapidaMediaLenta|AAAAMMDDhhmm de la vela.
 */
function construirId(nombreActivo, timeframe, mediaRapida, mediaLenta, tiempoVelaUnix) {
  const d = new Date(tiempoVelaUnix * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const marca = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const combo = `${mediaRapida}-${mediaLenta}`.replace(/\s+/g, '');
  return `${nombreActivo}|${timeframe}-${combo}|${marca}`;
}

module.exports = {
  buscarRegla, construirMensaje, construirId, etiquetaTimeframe,
};

/**
 * Calcula variaciones porcentuales a partir de un array de velas DIARIAS
 * (ordenadas de antiguo a reciente, con {time, close}). `time` en segundos unix.
 *
 * - dia: cierre de hoy vs cierre de ayer (o precio actual vs cierre anterior)
 * - 5d/1m/3m/1a/5a: vs el cierre de N sesiones atras (aproximacion estandar de
 *   mercado: 21 sesiones/mes, 63/trimestre, 252/año, 1260/5 años)
 * - ytd: vs el ultimo cierre del año natural anterior
 */
function calcularVariaciones(velasDiarias) {
  const n = velasDiarias.length;
  if (n < 2) {
    return {
      varDia: null, var5d: null, var1m: null, var3m: null, varYtd: null, var1a: null, var5a: null,
    };
  }
  const actual = velasDiarias[n - 1].close;

  const pct = (indiceAtras) => {
    const idx = n - 1 - indiceAtras;
    if (idx < 0) return null;
    const base = velasDiarias[idx].close;
    if (!base) return null;
    return ((actual - base) / base) * 100;
  };

  // YTD: buscamos la ultima vela cuyo año sea distinto (anterior) al de la vela actual
  const anioActual = new Date(velasDiarias[n - 1].time * 1000).getFullYear();
  let varYtd = null;
  for (let i = n - 2; i >= 0; i -= 1) {
    const anio = new Date(velasDiarias[i].time * 1000).getFullYear();
    if (anio < anioActual) {
      varYtd = ((actual - velasDiarias[i].close) / velasDiarias[i].close) * 100;
      break;
    }
  }

  return {
    varDia: pct(1),
    var5d: pct(5),
    var1m: pct(21),
    var3m: pct(63),
    varYtd,
    var1a: pct(252),
    var5a: pct(1260),
  };
}

module.exports = { calcularVariaciones };

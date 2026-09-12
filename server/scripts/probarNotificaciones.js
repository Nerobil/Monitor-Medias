/**
 * Prueba de notificaciones: envia un aviso de ejemplo por los canales que
 * tengas activos (Telegram/Email), SIN tocar TradingView ni la base de datos.
 * Util para comprobar que las credenciales llegan bien al entorno real
 * (local, o GitHub Actions) sin esperar a que se detecte un cruce de verdad.
 *
 * Uso:  npm run probar-notificaciones
 */
require('dotenv').config();
const { aplicarEsquema } = require('../db/cliente');
const repo = require('../db/repositorio');
const { despacharAvisos } = require('../src/notificadores');

const avisoDePrueba = {
  id: 'PRUEBA|60-EMA9-EMA21|000000000000',
  nombreActivo: 'Activo de prueba',
  mercado: 'Mercado de prueba',
  timeframe: '60',
  nivel: 2,
  mensaje: `Esto es un mensaje de prueba del Monitor de Cruces (${new Date().toLocaleString('es-ES')}). Si lo has recibido, el canal funciona correctamente.`,
};

async function main() {
  await aplicarEsquema();
  const telegramActivo = (await repo.obtenerConfigGeneral('canal_telegram', 'true')) === 'true';
  const emailActivo = (await repo.obtenerConfigGeneral('canal_email', 'true')) === 'true';
  console.log(`Canales segun /ajustes.html -> Telegram: ${telegramActivo ? 'ON' : 'OFF'}, Email: ${emailActivo ? 'ON' : 'OFF'}`);
  console.log('Enviando aviso de prueba...');
  const { enviados, errores } = await despacharAvisos([avisoDePrueba], { telegramActivo, emailActivo });

  if (enviados.length) {
    console.log(`✅ Enviado correctamente por: ${enviados.join(', ')}`);
  } else {
    console.log('⚠️  No se ha enviado por ningun canal (revisa si estan activos en /ajustes.html).');
  }

  if (errores.length) {
    console.log('❌ Errores encontrados:');
    errores.forEach((e) => console.log(`   - ${e.canal}: ${e.error}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});

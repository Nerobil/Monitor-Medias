const { enviarAvisoCorreo } = require('./email');
const { enviarAvisoTelegram } = require('./telegram');

/**
 * Envia los avisos por todos los canales activados en el entorno:
 *   CANAL_TELEGRAM=true/false (recomendado como principal: instantaneo, push al
 *     movil incluido iPhone via la app de Telegram, gratis, sin caer en Spam)
 *   CANAL_EMAIL=true/false (de respaldo)
 * No lanza excepcion si un canal falla: registra el error y continua con el resto,
 * para que un problema de correo no impida recibir el aviso por Telegram o viceversa.
 */
async function despacharAvisos(avisos) {
  if (!avisos.length) return { enviados: [], errores: [] };
  const errores = [];
  const enviados = [];

  const telegramActivo = String(process.env.CANAL_TELEGRAM || 'true') === 'true';
  const emailActivo = String(process.env.CANAL_EMAIL || 'false') === 'true';

  if (telegramActivo) {
    try {
      await enviarAvisoTelegram(avisos);
      enviados.push('telegram');
    } catch (err) {
      errores.push({ canal: 'telegram', error: err.message });
    }
  }

  if (emailActivo) {
    try {
      await enviarAvisoCorreo(avisos);
      enviados.push('email');
    } catch (err) {
      errores.push({ canal: 'email', error: err.message });
    }
  }

  return { enviados, errores };
}

module.exports = { despacharAvisos };

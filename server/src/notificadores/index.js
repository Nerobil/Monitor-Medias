const { enviarAvisoCorreo } = require('./email');
const { enviarAvisoTelegram } = require('./telegram');

/**
 * Envia los avisos por todos los canales activados en el entorno:
 *
 *   Telegram: activo salvo que pongas CANAL_TELEGRAM=false explicitamente.
 *   Email: activo automaticamente en cuanto configures EMAIL_HOST (no hace
 *     falta ningun interruptor aparte), salvo que pongas CANAL_EMAIL=false
 *     explicitamente para desactivarlo aun teniendo las credenciales puestas.
 *
 * No lanza excepcion si un canal falla: registra el error y continua con el
 * resto, para que un problema de correo no impida recibir el aviso por
 * Telegram o viceversa.
 */
async function despacharAvisos(avisos) {
  if (!avisos.length) return { enviados: [], errores: [] };
  const errores = [];
  const enviados = [];

  const telegramActivo = process.env.CANAL_TELEGRAM !== 'false';
  const emailActivo = process.env.CANAL_EMAIL === 'false'
    ? false
    : Boolean(process.env.EMAIL_HOST);

  console.log(`[notificadores] Telegram: ${telegramActivo ? 'activo' : 'desactivado'}. Email: ${emailActivo ? 'activo' : 'desactivado'} (EMAIL_HOST ${process.env.EMAIL_HOST ? 'presente' : 'vacio'}).`);

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

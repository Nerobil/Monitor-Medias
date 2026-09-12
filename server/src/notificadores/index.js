const { enviarAvisoCorreo } = require('./email');
const { enviarAvisoTelegram } = require('./telegram');

/**
 * Envia los avisos por los canales activados.
 *
 * Los interruptores de encendido/apagado viven en la base de datos
 * (config_general: canal_telegram / canal_email) y se gestionan desde la
 * pagina web /ajustes.html - asi se pueden activar/desactivar sin tocar
 * GitHub. `opciones.telegramActivo`/`opciones.emailActivo` los pasa
 * cicloMonitor.js ya leidos de la base de datos; si no se pasan (por
 * ejemplo, al llamar a esta funcion directamente desde un script suelto),
 * se usa el comportamiento antiguo basado en variables de entorno como
 * red de seguridad.
 *
 * Las CREDENCIALES (token de Telegram, SMTP...) siguen viviendo solo en
 * variables de entorno/Secrets, nunca en la base de datos.
 *
 * No lanza excepcion si un canal falla: registra el error y continua con el
 * resto, para que un problema de correo no impida recibir el aviso por
 * Telegram o viceversa.
 */
async function despacharAvisos(avisos, opciones = {}) {
  if (!avisos.length) return { enviados: [], errores: [] };
  const errores = [];
  const enviados = [];

  const telegramActivo = opciones.telegramActivo !== undefined
    ? opciones.telegramActivo
    : process.env.CANAL_TELEGRAM !== 'false';
  const emailActivo = opciones.emailActivo !== undefined
    ? opciones.emailActivo
    : (process.env.CANAL_EMAIL !== 'false' && Boolean(process.env.EMAIL_HOST));

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

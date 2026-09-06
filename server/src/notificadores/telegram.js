/**
 * Notificador por Telegram. Usa la Bot API directamente por HTTP (fetch nativo
 * de Node 18+), sin dependencias adicionales.
 *
 * Requiere en el entorno:
 *   TELEGRAM_BOT_TOKEN  -> token que da @BotFather al crear el bot
 *   TELEGRAM_CHAT_ID    -> id numerico del chat/usuario que recibe los avisos
 */
const LIMITE_TELEGRAM = 4000; // margen de seguridad bajo el limite real de 4096

function esperar(ms) {
  return new Promise((r) => { setTimeout(r, ms); });
}

async function enviarUnMensaje(texto) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: texto,
      parse_mode: 'MarkdownV2',
    }),
  });
  const data = await resp.json();
  if (!data.ok) {
    throw new Error(`Telegram rechazo el mensaje: ${data.description || JSON.stringify(data)}`);
  }
}

/**
 * Agrupa las lineas de aviso en varios mensajes si hace falta, para no
 * superar el limite de 4096 caracteres de Telegram (que rechaza el mensaje
 * COMPLETO si se pasa, sin enviar nada - por eso con pocos avisos funcionaba
 * y con muchos a la vez dejaba de llegar cualquier cosa).
 */
async function enviarAvisoTelegram(avisos) {
  if (!avisos.length) return;
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Faltan variables TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en el fichero .env');
  }

  if (avisos.length === 1) {
    await enviarUnMensaje(`🔔 *${escapar(avisos[0].nombreActivo)}* — Nivel ${avisos[0].nivel}\n${escapar(avisos[0].mensaje)}`);
    return;
  }

  const lineas = avisos.map((a) => `• ${escapar(a.mensaje)}`);
  const bloques = [];
  let actual = [];
  let longitudActual = 0;
  for (const linea of lineas) {
    if (longitudActual + linea.length + 1 > LIMITE_TELEGRAM && actual.length) {
      bloques.push(actual);
      actual = [];
      longitudActual = 0;
    }
    actual.push(linea);
    longitudActual += linea.length + 1;
  }
  if (actual.length) bloques.push(actual);

  for (let i = 0; i < bloques.length; i += 1) {
    const cabecera = bloques.length > 1
      ? `🔔 *${avisos.length} cruces detectados* \\(parte ${i + 1}/${bloques.length}\\)`
      : `🔔 *${avisos.length} cruces detectados*`;
    const texto = [cabecera, '', ...bloques[i]].join('\n');
    // eslint-disable-next-line no-await-in-loop
    await enviarUnMensaje(texto);
    // Telegram limita el ritmo de mensajes a un mismo chat; una pequena
    // pausa entre bloques evita que los envios intermedios sean rechazados.
    if (i < bloques.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await esperar(1100);
    }
  }
}

/** Escapa caracteres especiales de Markdown de Telegram (modo clasico). */
function escapar(texto) {
  return String(texto).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = { enviarAvisoTelegram };

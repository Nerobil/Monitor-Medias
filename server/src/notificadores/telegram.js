/**
 * Notificador por Telegram. Usa la Bot API directamente por HTTP (fetch nativo
 * de Node 18+), sin dependencias adicionales.
 *
 * Requiere en el entorno:
 *   TELEGRAM_BOT_TOKEN  -> token que da @BotFather al crear el bot
 *   TELEGRAM_CHAT_ID    -> id numerico del chat/usuario que recibe los avisos
 */
async function enviarAvisoTelegram(avisos) {
  if (!avisos.length) return;
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Faltan variables TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en el fichero .env');
  }

  const texto = avisos.length === 1
    ? `🔔 *${escapar(avisos[0].nombreActivo)}* — Nivel ${avisos[0].nivel}\n${escapar(avisos[0].mensaje)}`
    : [`🔔 *${avisos.length} cruces detectados*`, '', ...avisos.map((a) => `• ${escapar(a.mensaje)}`)].join('\n');

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

/** Escapa caracteres especiales de Markdown de Telegram (modo clasico). */
function escapar(texto) {
  return String(texto).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = { enviarAvisoTelegram };

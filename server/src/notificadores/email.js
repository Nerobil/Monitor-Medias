const nodemailer = require('nodemailer');

let transportador = null;

function obtenerTransportador() {
  if (transportador) return transportador;
  const {
    EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_SECURE,
  } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Faltan variables EMAIL_HOST / EMAIL_USER / EMAIL_PASS en el fichero .env');
  }
  transportador = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT || 587),
    secure: String(EMAIL_SECURE || 'false') === 'true',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return transportador;
}

/**
 * Envia un correo con la lista de cruces detectados en esta ejecucion.
 * @param {{nombreActivo:string, mensaje:string, nivel:string|number}[]} avisos
 */
async function enviarAvisoCorreo(avisos) {
  if (!avisos.length) return;
  const { EMAIL_FROM, EMAIL_TO, EMAIL_USER } = process.env;
  const asunto = avisos.length === 1
    ? `[Monitor Cruces] ${avisos[0].nombreActivo} - Nivel ${avisos[0].nivel}`
    : `[Monitor Cruces] ${avisos.length} cruces detectados`;

  const cuerpo = avisos.map((a) => `- ${a.mensaje}`).join('\n\n');

  await obtenerTransportador().sendMail({
    from: EMAIL_FROM || EMAIL_USER,
    to: EMAIL_TO,
    subject: asunto,
    text: cuerpo,
  });
}

module.exports = { enviarAvisoCorreo };

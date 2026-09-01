import { createClient } from '@libsql/client/web';

/**
 * Cliente de base de datos para las Functions de Cloudflare Pages (edge runtime).
 * No hay `process.env` aqui: las variables llegan por `context.env`, configuradas
 * en el panel de Cloudflare Pages (Settings > Environment variables).
 */
export function clienteDb(env) {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

export function jsonOk(datos, init) {
  return new Response(JSON.stringify(datos), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export function jsonError(mensaje, status = 500) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

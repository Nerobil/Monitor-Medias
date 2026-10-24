/**
 * POST /api/ciclo/ejecutar
 *
 * Boton "Ejecutar ahora" del panel: lanza el workflow de GitHub Actions
 * (ciclo.yml) igual que el boton "Run workflow" de la pestaña Actions, pero
 * sin que el navegador vea nunca el token de GitHub (vive solo aqui, como
 * secreto de Cloudflare Pages).
 *
 * Variables de entorno (Cloudflare Pages > Settings > Variables and Secrets):
 *   GITHUB_TOKEN      (secreto, obligatoria) token fine-grained con Actions: lectura y escritura
 *   GITHUB_REPO       (obligatoria)          "usuario/repositorio", ej. Nerobil/Monitor-Medias
 *   GITHUB_WORKFLOW   (opcional)             fichero del workflow. Por defecto ciclo.yml
 *   GITHUB_REF        (opcional)             rama. Por defecto main
 *   COOLDOWN_MINUTOS  (opcional)             espera minima entre lanzamientos. Por defecto 3
 *   EJECUCION_CLAVE   (opcional)             si se define, el panel pide esa clave antes de lanzar
 *
 * Protecciones: no lanza si ya hay una ejecucion en curso o en cola, respeta
 * una espera minima desde la ultima ejecucion (cuenta tambien las lanzadas por
 * cron-job.org) y, si se configura EJECUCION_CLAVE, exige la clave.
 */

const API = 'https://api.github.com';
const ESTADOS_ACTIVOS = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

function respuesta(datos, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function cabecerasGithub(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'monitor-cruces-web', // GitHub rechaza peticiones sin User-Agent
  };
}

function mensajeErrorGithub(status) {
  switch (status) {
    case 401: return 'GitHub ha rechazado el token (caducado, revocado o mal copiado).';
    case 403: return 'El token no tiene permiso "Actions: lectura y escritura" sobre el repositorio (o falta aprobarlo en la organización).';
    case 404: return 'GitHub no encuentra el repositorio o el workflow. Revisa GITHUB_REPO, GITHUB_WORKFLOW y que el token tenga acceso a ese repositorio.';
    case 422: return 'GitHub no puede lanzar el workflow: comprueba que ciclo.yml incluya workflow_dispatch y que la rama (GITHUB_REF) exista.';
    default: return `GitHub ha respondido con el código ${status}.`;
  }
}

// Comparacion sin atajos por longitud/contenido para no filtrar la clave por tiempos.
function iguales(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] || 0) ^ (y[i] || 0);
  return dif === 0;
}

export async function onRequestPost({ request, env }) {
  const token = (env.GITHUB_TOKEN || '').trim();
  const repo = (env.GITHUB_REPO || '').trim();
  if (!token || !repo) {
    return respuesta({
      error: 'El lanzamiento manual no está configurado: faltan GITHUB_TOKEN y GITHUB_REPO en Cloudflare Pages (ver MANUAL.md, sección 12).',
    }, 501);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return respuesta({ error: 'GITHUB_REPO debe tener el formato usuario/repositorio.' }, 500);
  }
  const workflow = (env.GITHUB_WORKFLOW || 'ciclo.yml').trim();
  if (!/^[\w.-]+\.ya?ml$/.test(workflow)) {
    return respuesta({ error: 'GITHUB_WORKFLOW debe ser el nombre de un fichero .yml (ej. ciclo.yml).' }, 500);
  }
  const ref = (env.GITHUB_REF || 'main').trim();
  const cooldownEnv = Number(env.COOLDOWN_MINUTOS);
  const cooldownSeg = (Number.isFinite(cooldownEnv) && env.COOLDOWN_MINUTOS !== undefined && env.COOLDOWN_MINUTOS !== '' ? cooldownEnv : 3) * 60;
  const actionsUrl = `https://github.com/${repo}/actions/workflows/${workflow}`;

  if (env.EJECUCION_CLAVE) {
    const dada = request.headers.get('X-Clave') || '';
    if (!iguales(dada, String(env.EJECUCION_CLAVE))) {
      return respuesta({ error: 'Clave incorrecta o ausente.', requiereClave: true }, 401);
    }
  }

  const cabeceras = cabecerasGithub(token);
  const base = `${API}/repos/${repo}/actions/workflows/${workflow}`;

  try {
    // 1) Comprobar ejecuciones recientes / en curso
    const rRuns = await fetch(`${base}/runs?per_page=5`, { headers: cabeceras });
    if (!rRuns.ok) return respuesta({ error: mensajeErrorGithub(rRuns.status) }, 502);
    const runs = (await rRuns.json()).workflow_runs || [];

    if (runs.some((r) => ESTADOS_ACTIVOS.has(r.status))) {
      return respuesta({ error: 'Ya hay una ejecución en curso o en cola. Espera a que termine.', actionsUrl }, 409);
    }
    if (runs.length && cooldownSeg > 0) {
      const hace = (Date.now() - new Date(runs[0].created_at).getTime()) / 1000;
      const restante = Math.ceil(cooldownSeg - hace);
      if (restante > 0) {
        return respuesta({
          error: `Se lanzó una ejecución hace muy poco. Vuelve a intentarlo en ${restante} s.`,
          reintentarEnSegundos: restante,
          actionsUrl,
        }, 429);
      }
    }

    // 2) Lanzar el workflow (equivale a "Run workflow")
    const rDisp = await fetch(`${base}/dispatches`, {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    });
    if (rDisp.status !== 204) return respuesta({ error: mensajeErrorGithub(rDisp.status) }, 502);

    return respuesta({ ok: true, mensaje: 'Ejecución lanzada en GitHub. En 1-2 minutos aparecerán los resultados.', actionsUrl });
  } catch {
    return respuesta({ error: 'No se pudo contactar con GitHub. Inténtalo de nuevo en unos segundos.' }, 502);
  }
}

# Manual — Monitor de Cruces de Medias Móviles (v2, nube)

Manual para poner en marcha el sistema completo: base de datos en la nube, motor
de vigilancia automático, panel web y notificaciones. Pensado para alguien con
conocimientos básicos (usar una terminal, copiar/pegar comandos, crear cuentas
online) — no hace falta saber programar.

**Tiempo estimado:** 45-60 minutos la primera vez.

---

## 0. Qué vas a montar

```
TradingView  →  GitHub Actions (cada 15 min)  →  Turso (base de datos)  →  Cloudflare Pages (panel web)
                  "motor de vigilancia"           reemplaza al Excel         lo abres desde el iPhone o donde sea
                                                          ↓
                                            Telegram / Email (avisos)
```

Todo con capas gratuitas: no vas a pagar nada para uso personal.

**Por qué esta combinación** (revisado en 2026): Render y Railway son cómodos
pero su plan gratuito "duerme" el servicio y tarda 30-60s en despertar; Fly.io
dejó de tener capa gratuita. GitHub Actions no duerme nunca (es un cron, no un
servidor) y Cloudflare Pages sirve páginas estáticas + funciones sin *cold
start*, ideal para abrir el panel desde el móvil al instante.

---

## 1. Herramientas que necesitas crear (todas gratis)

| Servicio | Para qué | Web |
|---|---|---|
| Cuenta de GitHub | Guardar el código y ejecutar el motor de vigilancia | github.com |
| Cuenta de Turso | Base de datos (sustituye al Excel) | turso.tech |
| Cuenta de Cloudflare | Alojar el panel web | dash.cloudflare.com |
| Bot de Telegram | Recibir los avisos al instante | vía Telegram, gratis |
| Node.js 20+ instalado en tu ordenador | Solo para las pruebas locales del principio | nodejs.org |

---

## 2. Prueba local primero (recomendado antes de subir nada a la nube)

1. Instala Node.js LTS desde **nodejs.org** si no lo tienes.
2. Descomprime el `.zip` de este proyecto en una carpeta, por ejemplo
   `Documentos\monitor-cruces`.
3. Copia tu fichero `Monitor_Cruces_Medias_Moviles.xlsx` original a la raíz del
   proyecto (junto a las carpetas `server` y `web`).
4. Abre una terminal en la carpeta `server` (`cd monitor-cruces/server`) y
   ejecuta:
   ```
   npm install
   ```
   Ahora crea el fichero `.env`:
   - **Windows (cmd):** `copy .env.example .env`
   - **Windows (PowerShell) / Mac / Linux:** `cp .env.example .env`

   Sin tocar nada más en `.env`, esto usará una base de datos local de prueba
   (un fichero en `server/data/monitor.db`), sin necesidad de Turso todavía.
5. Importa tus datos actuales del Excel:
   ```
   npm run migrar-desde-excel -- ../Monitor_Cruces_Medias_Moviles.xlsx
   ```
   Verás un resumen de cuántos activos, medias y reglas se importaron.
6. Lanza un ciclo de prueba (se conecta a TradingView de verdad):
   ```
   npm run ciclo
   ```
7. Arranca el panel local:
   ```
   npm start
   ```
   Abre **http://localhost:3000** en el navegador. Si hubo algún cruce en el
   paso anterior, lo verás ahí; si no, verás "Sin alertas activas" (normal).
   En **http://localhost:3000/universo.html** puedes dar de alta activos nuevos
   con autocompletado desde TradingView.

Si todo esto funciona en tu ordenador, ya sabes que la lógica es correcta y
solo queda "mudarla" a la nube.

---

## 3. Sube el proyecto a GitHub

**Recomendado: usa GitHub Desktop** (desktop.github.com), no arrastres carpetas
por la web. La razón: el navegador (y la propia web de subida de GitHub)
**omite en silencio cualquier carpeta cuyo nombre empiece por un punto**, como
`.github` — que es justo la carpeta que hace funcionar el motor de vigilancia
automático — y también `.gitignore`. No avisa de que se ha saltado nada.

1. Instala GitHub Desktop y crea un repositorio nuevo desde ahí (**File → New
   repository**, o crea uno vacío en la web de GitHub y luego **File → Clone
   repository** en la app).
2. Copia **todo** el contenido descomprimido del `.zip` dentro de la carpeta
   que gestiona GitHub Desktop en tu PC (sustituyendo lo que hubiera, sin
   tocar la carpeta invisible `.git`).
3. En GitHub Desktop, pestaña **Changes**, escribe un mensaje de commit (ej.
   "Version inicial"), pulsa **Commit to main** y luego **Push origin**.
4. Comprueba en la web de tu repositorio que la carpeta `.github` aparece
   junto a `server` y `web` — si no aparece, no se subió bien y el motor de
   vigilancia (paso 5) no funcionará.

Si prefieres la línea de comandos: `git init`, `git add .`,
`git commit -m "inicial"`, `git remote add origin <url>`,
`git push -u origin main` — Git por comandos sí sube las carpetas con punto
correctamente, al igual que GitHub Desktop.

**Importante:** el `.gitignore` incluido ya excluye tu `.env` y la base de
datos local, así que no subirás datos sensibles por accidente — pero solo si
ese fichero llegó realmente a GitHub (comprueba el paso 4 de arriba).

---

## 4. Crea la base de datos en Turso

1. Ve a **turso.tech**, crea una cuenta gratis (no pide tarjeta).
2. Instala su CLI o usa el panel web para crear una base de datos nueva,
   nómbrala por ejemplo `monitor-cruces`.
3. Obtén dos datos, los necesitarás en el paso 5 y 6:
   - **Database URL** (empieza por `libsql://...`)
   - **Auth Token** (un texto largo; en el panel de Turso suele estar en
     "Create Token" o similar)

---

## 5. Configura GitHub Actions (el motor de vigilancia)

1. En tu repositorio de GitHub, ve a **Settings → Secrets and variables →
   Actions**.
2. Añade estos **Secrets** (botón "New repository secret"):

   | Nombre | Valor |
   |---|---|
   | `TURSO_DATABASE_URL` | la URL que copiaste de Turso |
   | `TURSO_AUTH_TOKEN` | el token que copiaste de Turso |
   | `TELEGRAM_BOT_TOKEN` | lo obtienes en el paso 7 |
   | `TELEGRAM_CHAT_ID` | lo obtienes en el paso 7 |

   (Si además quieres email de respaldo, añade también `EMAIL_HOST`,
   `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `EMAIL_TO` con tus datos de
   Yahoo, y crea la variable `CANAL_EMAIL` = `true` en la pestaña
   "Variables" en vez de "Secrets".)

3. Ve a la pestaña **Actions** de tu repositorio y activa los workflows si te
   lo pide. El fichero `.github/workflows/ciclo.yml` ya está listo: se
   ejecutará automáticamente **cada 15 minutos**.
4. Para probarlo ya, sin esperar: pestaña **Actions** → "Ciclo de vigilancia -
   Monitor de Cruces" → botón **Run workflow**.
5. Antes de tener datos reales en Turso, necesitas migrar tu Excel una vez
   **contra Turso** (no contra tu base local). La forma segura y que funciona
   igual en cmd, PowerShell, Mac o Linux es escribir las credenciales en el
   fichero `.env` en vez de pasarlas en la línea de comandos:

   1. Abre `server\.env` con el Bloc de notas (el mismo que creaste en el
      paso 2; si no existe, cópialo primero de `.env.example`).
   2. Rellena estas dos líneas con los datos reales de Turso (sin comillas):
      ```
      TURSO_DATABASE_URL=libsql://tu-base-datos.turso.io
      TURSO_AUTH_TOKEN=el_token_largo_que_te_dio_turso
      ```
   3. Guarda el fichero.
   4. En la terminal, dentro de la carpeta `server`, ejecuta simplemente:
      ```
      npm run migrar-desde-excel -- ../Monitor_Cruces_Medias_Moviles.xlsx
      ```
      Sin anteponer nada delante — al leer `.env`, el programa ya sabe
      conectarse a Turso. Esto funciona igual en `cmd` que en PowerShell.

   > **Por qué falló antes:** `VARIABLE=valor comando` (todo en una línea) es
   > sintaxis de Linux/Mac. Ni `cmd` ni PowerShell la entienden — cada uno
   > intenta ejecutar `TURSO_DATABASE_URL="..."` como si fuera el nombre de un
   > programa, de ahí el error de "no se reconoce como comando". Poniendo los
   > valores en `.env` te evitas ese problema por completo, y de paso no dejas
   > el token pegado en el historial de la terminal.
   >
   > Si aun así prefieres pasarlo por línea de comandos sin tocar `.env`:
   > - **cmd:** `set TURSO_DATABASE_URL=libsql://...` y `set TURSO_AUTH_TOKEN=...`
   >   (cada uno en su propia línea, sin comillas), y luego en esa misma
   >   ventana `npm run migrar-desde-excel -- ../Monitor_Cruces_Medias_Moviles.xlsx`.
   > - **PowerShell:** `$env:TURSO_DATABASE_URL="libsql://..."` y
   >   `$env:TURSO_AUTH_TOKEN="..."` (cada uno en su propia línea), y luego el
   >   mismo comando `npm run migrar-desde-excel -- ...`.
   >   Estas variables solo duran mientras esa ventana de terminal está abierta.

**Nota sobre el cron:** GitHub pausa automáticamente los workflows programados
si el repositorio lleva 60 días sin actividad alguna. Si eso pasa, basta con
volver a "Run workflow" una vez a mano para reactivarlo.

---

## 6. Publica el panel web en Cloudflare Pages

1. Entra en **dash.cloudflare.com** → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**, y elige tu repositorio.
2. En la configuración de compilación:
   - **Root directory:** `web`
   - **Build command:** (déjalo vacío)
   - **Build output directory:** `/` (o déjalo vacío, es la raíz de `web`)
3. En **Settings → Environment variables** del proyecto de Pages, añade:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Guarda y despliega. Cloudflare te dará una URL tipo
   `https://monitor-cruces.pages.dev` — ábrela desde el ordenador o el iPhone,
   funciona como una app (puedes "Añadir a pantalla de inicio" en Safari para
   que se comporte como una app nativa).

---

## 7. Crea tu bot de Telegram (canal de avisos principal)

1. En Telegram, busca el usuario **@BotFather** y escríbele `/newbot`.
2. Ponle un nombre y un usuario (debe terminar en "bot", ej. `MonitorCrucesBot`).
3. BotFather te dará un **token** (algo como `123456789:AAExxxxx...`). Ese es
   tu `TELEGRAM_BOT_TOKEN`.
4. Ahora necesitas tu **chat_id**: escríbele cualquier mensaje a tu bot recién
   creado (búscalo por su usuario y pulsa "Iniciar"), y luego visita en el
   navegador (sustituyendo tu token):
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
   Verás un JSON con `"chat":{"id": 123456789, ...}` — ese número es tu
   `TELEGRAM_CHAT_ID`.
5. Añade ambos valores como Secrets en GitHub (paso 5).

A partir de aquí, cada cruce detectado te llegará como mensaje de Telegram al
instante, sin depender de carpetas de spam.

---

## 8. Comprobación final

1. Espera a que pasen 15 minutos (o lanza el workflow a mano) y revisa la
   pestaña **Actions** de GitHub: debe aparecer una ejecución en verde.
2. Abre tu panel de Cloudflare Pages: si hubo algún cruce nuevo dado de alta
   en `Niveles_Importancia`, debería aparecer la tarjeta del activo.
3. Si configuraste Telegram, deberías recibir el mensaje correspondiente.

---

## 9. Uso del día a día

- **Añadir activos nuevos:** entra en `tu-panel.pages.dev/universo.html`,
  busca el activo por nombre o ticker, pulsa "Usar" para autocompletar los
  datos desde TradingView, y "Dar de alta". No hay límite de activos.
- **Añadir/editar reglas de qué cruces vigilar** (tabla
  `niveles_importancia`): de momento se gestiona directamente en Turso. Desde
  tu ordenador, con la CLI de Turso instalada:
  ```
  turso db shell monitor-cruces
  INSERT INTO niveles_importancia (media_rapida, media_lenta, timeframe, nivel)
  VALUES ('EMA 9', 'EMA 21', '60', 2);
  ```
  (`timeframe` es `'15'`, `'30'`, `'60'`, `'240'` o `'1D'`.)
- **Filtrar por nivel de aviso:** en el panel, junto al filtro de timeframe,
  está el filtro **Nivel** (Nivel 1, Nivel 2, ...). Puedes marcar varios a la
  vez (ej. solo Nivel 2 y 3) o pulsar **Todos** para quitar el filtro. Los
  niveles que aparecen son los dados de alta en `niveles.html`. El filtro se
  aplica al instante en el navegador y se combina con el de timeframe.
- **Apagar un timeframe o el RSI del panel:** usa los chips de arriba a la
  derecha en el propio panel web (15m/30m/1h/4h/1D/RSI) — se guardan al
  instante para todos los que abran el panel.
- **Consultar el histórico completo:** `GET /api/historico` desde el propio
  dominio de tu panel (o te preparo una pantalla dedicada si la quieres).

---

## 10. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El workflow de GitHub Actions falla | Revisa que los 4 Secrets de Turso/Telegram estén bien copiados (sin espacios extra). Mira el log del job en la pestaña Actions para el error exacto. |
| El panel web da error o no carga datos | Revisa las variables de entorno en Cloudflare Pages → Settings, y que el "Root directory" sea `web`. |
| No llegan avisos de Telegram | Comprueba que le diste a "Iniciar" en el chat con tu bot antes de pedir `getUpdates`, y que el chat_id no tenga un signo menos delante si es un chat de grupo (en ese caso avísame, hay que ajustar el envío). |
| Un cruce sale "Nivel" en blanco | No hay ninguna regla en `niveles_importancia` para exactamente esa combinación media_rapida/media_lenta/timeframe — revisa que las etiquetas coincidan literalmente (ej. `EMA 9`, con un espacio). |
| Un activo no aparece nunca aunque tenga cruces | Comprueba en `universo.html` que su Estado sea "Activo" y que el símbolo de TradingView sea correcto (pruébalo en tradingview.com/symbols/). |

Si algo no encaja, dímelo con el mensaje de error exacto y lo resolvemos.

---

## 11. Disparo externo del workflow (cuando GitHub no ejecuta el cron a tiempo)

**El problema:** GitHub avisa de que los workflows programados (`schedule`) pueden
retrasarse o saltarse en las horas de mucha carga global (sobre todo al inicio de
cada hora). Lanzar el workflow a mano (**Run workflow**) sí funciona porque usa
otro mecanismo: el evento `workflow_dispatch`.

**La solución:** un servicio gratuito externo (**cron-job.org**) llama cada cierto
tiempo a la API de GitHub y dispara ese mismo evento `workflow_dispatch`. Es
exactamente lo mismo que pulsar **Run workflow**, pero automático. No hace falta
programar nada ni desplegar ninguna aplicación: tu `ciclo.yml` ya incluye
`workflow_dispatch` y `concurrency` (si llegan dos disparos a la vez, nunca se
ejecutan en paralelo).

> Esto evita el retraso propio del cron de GitHub, pero no puede garantizar un
> inicio instantáneo si los *runners* de GitHub están saturados: en ese caso la
> ejecución aparecerá en la pestaña Actions como "Queued" hasta que haya hueco.

### 11.1 Datos que necesitas tener a mano

| Dato | Ejemplo |
|---|---|
| Usuario y repositorio de GitHub | `tu-usuario/monitor-cruces` |
| Rama principal | `main` |
| Nombre del fichero del workflow | `ciclo.yml` |

### 11.2 Crear un token de GitHub con permisos mínimos

1. En GitHub: foto de perfil → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** →
   **Generate new token**.
2. **Token name:** `monitor-cruces-disparo`.
3. **Expiration:** el máximo que te permita (anota la fecha: tendrás que
   renovarlo, ver 11.7).
4. **Repository access:** *Only select repositories* → elige **solo** tu
   repositorio del monitor.
5. **Permissions → Repository permissions → Actions:** *Read and write*.
   No marques nada más.
6. **Generate token** y copia el valor (empieza por `github_pat_...`). GitHub no
   vuelve a mostrarlo.  "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"

Si el repositorio pertenece a una organización, puede que el propietario tenga
que aprobar el token.

### 11.3 Probar el token desde tu ordenador (antes de usar el servicio)

Sustituye `TU_USUARIO`, `TU_REPO` y `TU_TOKEN` por tus datos.

- **Windows (PowerShell):**
  ```
  Invoke-RestMethod -Method Post `
    -Uri "https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/ciclo.yml/dispatches" `  --> https://api.github.com/repos/Nerobil/Monitor-Medias/actions/workflows/ciclo.yml/dispatches
    -Headers @{ Authorization="Bearer TU_TOKEN"; Accept="application/vnd.github+json"; "X-GitHub-Api-Version"="2022-11-28" } `
    -ContentType "application/json" -Body '{"ref":"main"}'
  ```
- **Mac / Linux:**
  ```
  curl -i -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer TU_TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    -d '{"ref":"main"}' \
    https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/ciclo.yml/dispatches
  ```

**Resultado correcto:** no devuelve texto (PowerShell no muestra nada; `curl`
muestra `HTTP/2 204`). Ve a la pestaña **Actions** de tu repositorio: debe
aparecer una ejecución nueva "Ciclo de vigilancia" con el evento
`workflow_dispatch`. Si te da error, mira la tabla 11.8.

### 11.4 Programar el disparo en cron-job.org

1. Crea una cuenta gratuita en **cron-job.org** (sin tarjeta) y entra en la
   consola → **Create cronjob**.
2. Rellena la pestaña principal:
   - **Title:** `Monitor de Cruces - disparo`
   - **URL:**
     `https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/ciclo.yml/dispatches`
   - **Execution schedule:** la frecuencia que elijas (ver 11.6). Recomendado
     para empezar: **cada hora, en el minuto 5** (evita el minuto 0, el más
     saturado de GitHub).
3. Abre la pestaña **Advanced** y configura:
   - **Request method:** `POST`
   - **Request body:** `{"ref":"main"}`
   - **Headers** (añade estos cuatro, uno por uno, nombre y valor):

     | Nombre | Valor |
     |---|---|
     | `Authorization` | `Bearer TU_TOKEN` |
     | `Accept` | `application/vnd.github+json` |
     | `X-GitHub-Api-Version` | `2022-11-28` |
     | `Content-Type` | `application/json` |
4. Activa el aviso por email si el trabajo **falla** (opción de notificaciones
   del propio job): así te enteras si el token caduca o se revoca.
5. Guarda, y pulsa **Test run** (o "Run now"). Debe indicar éxito con código
   **204**, y en GitHub → Actions debe aparecer una ejecución nueva.

(Los nombres exactos de pestañas y botones de cron-job.org pueden variar
ligeramente con el tiempo; lo importante son los valores de arriba.)

### 11.5 Evitar ejecuciones duplicadas

Cuando compruebes que el disparo externo funciona bien durante un par de días,
**comenta o borra el bloque `schedule`** de `.github/workflows/ciclo.yml` (las
dos líneas `schedule:` y `- cron: ...`), dejando `workflow_dispatch: {}`. Si lo
mantienes, tendrás dos disparadores y consumirás minutos de más (el
`concurrency` evita que se solapen, pero no que se ejecuten una tras otra).

Si prefieres mantenerlo como "red de seguridad", cámbialo a un minuto poco
saturado (por ejemplo `'35 * * * *'`) y programa el externo en otro minuto.

### 11.6 Frecuencia y minutos de GitHub Actions

Cada disparo gasta minutos de Actions: **ejecuciones al mes × duración de cada
ciclo** (GitHub redondea hacia arriba cada ejecución a minutos completos).

| Frecuencia | Ejecuciones/mes (aprox.) |
|---|---|
| Cada hora | 720 |
| Cada 30 min | 1.440 |
| Cada 15 min | 2.880 |

- Repositorio **privado**: el plan gratuito incluye 2.000 min/mes. Mira en la
  pestaña Actions cuánto dura un ciclo real y multiplica. Por ejemplo, con
  ciclos de 2 min: cada hora = 1.440 min (cabe); cada 30 min = 2.880 min (no
  cabe).
- Repositorio **público**: los *runners* estándar de GitHub no tienen límite
  de minutos.

### 11.7 Mantenimiento

- **Renueva el token antes de que caduque:** genera uno nuevo (11.2) y cambia el
  valor de la cabecera `Authorization` del job en cron-job.org.
- **Si sospechas que el token se filtró,** revócalo en GitHub (Settings →
  Developer settings) y crea otro. Un token así solo permite gestionar
  workflows de ese único repositorio (lanzarlos, cancelarlos, desactivarlos),
  no leer ni modificar tu código.
- No pegues nunca el token en ficheros del repositorio: solo vive en la
  configuración del job de cron-job.org.

### 11.8 Problemas frecuentes

| Respuesta | Causa probable |
|---|---|
| `401 Bad credentials` | Token mal copiado, caducado o revocado. Genera otro. |
| `403 Resource not accessible by personal access token` | El token no tiene **Actions: Read and write**, o la organización aún no lo ha aprobado. |
| `404 Not Found` | Usuario/repositorio mal escrito, nombre del fichero distinto a `ciclo.yml`, o el token no tiene acceso a ese repositorio. |
| `422 Workflow does not have 'workflow_dispatch' trigger` | El `ciclo.yml` subido a GitHub no contiene `workflow_dispatch: {}` (sube la versión actual del proyecto). |
| `422 No ref found` | La rama del cuerpo (`"ref":"main"`) no existe; si tu rama es `master`, cámbialo. |
| El job da éxito (204) pero no se ve ejecución | Revisa la pestaña Actions con el filtro correcto (workflow "Ciclo de vigilancia") y que el workflow no esté marcado como *disabled* (en ese caso, pulsa **Enable workflow**). |
| La ejecución se queda en "Queued" mucho rato | Saturación de *runners* de GitHub: es una cola de GitHub, no un fallo de tu configuración. |

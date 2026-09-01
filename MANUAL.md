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
   cp .env.example .env
   ```
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

1. Crea un repositorio nuevo en GitHub (puede ser **privado**).
2. Sube el contenido del `.zip` a ese repositorio (arrastrando los ficheros
   desde la web de GitHub es suficiente si no usas Git por línea de comandos;
   si lo usas: `git init`, `git add .`, `git commit -m "inicial"`,
   `git remote add origin <url>`, `git push -u origin main`).

**Importante:** el `.gitignore` incluido ya excluye tu `.env` y la base de
datos local, así que no subirás datos sensibles por accidente.

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
   **contra Turso** (no contra tu base local). Desde tu ordenador:
   ```
   cd server
   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run migrar-desde-excel -- ../Monitor_Cruces_Medias_Moviles.xlsx
   ```
   (En Windows con PowerShell, usa `$env:TURSO_DATABASE_URL="..."` en líneas
   separadas antes del comando, en vez de anteponerlo en la misma línea.)

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

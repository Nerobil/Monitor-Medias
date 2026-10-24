# Monitor de Cruces de Medias Móviles (v2)

Sistema de vigilancia de cruces de medias móviles sobre datos reales de
TradingView, con panel web, base de datos en la nube y avisos por Telegram/email.

👉 **Empieza por [`MANUAL.md`](./MANUAL.md)** — ahí está todo el paso a paso.

Si el cron de GitHub se retrasa o no se ejecuta, mira la sección 11 del manual
(disparo externo gratuito del workflow con cron-job.org).
El botón **▶ Ejecutar ahora** del panel se configura en la sección 12.

## Estructura del repositorio

```
server/     Motor de vigilancia (Node.js) — se ejecuta vía GitHub Actions
  db/       Esquema y acceso a la base de datos (SQLite / Turso)
  src/      Lógica: indicadores, detección de cruces, notificaciones
  scripts/  Migración desde el Excel original

web/        Panel web (Cloudflare Pages)
  index.html      Panel principal (alertas activas; filtros por timeframe y nivel)
  universo.html   Alta de activos con autocompletado desde TradingView
  niveles.html    Reglas de cruce (Niveles de Importancia)
  medias.html     Medias de referencia (tendencia del panel)
  ajustes.html    Timeframes vigilados y canales de notificación
  functions/api/  Funciones que sirven los datos al panel

mcp/        Servidor MCP — usa el Monitor de Cruces desde Claude Desktop/Code
  README.md       Cómo configurarlo
```

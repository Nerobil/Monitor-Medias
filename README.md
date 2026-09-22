# Monitor de Cruces de Medias Móviles (v2)

Sistema de vigilancia de cruces de medias móviles sobre datos reales de
TradingView, con panel web, base de datos en la nube y avisos por Telegram/email.

👉 **Empieza por [`MANUAL.md`](./MANUAL.md)** — ahí está todo el paso a paso.

## Estructura del repositorio

```
server/     Motor de vigilancia (Node.js) — se ejecuta vía GitHub Actions
  db/       Esquema y acceso a la base de datos (SQLite / Turso)
  src/      Lógica: indicadores, detección de cruces, notificaciones
  scripts/  Migración desde el Excel original

web/        Panel web (Cloudflare Pages)
  index.html      Panel principal (activos con alerta activa)
  universo.html   Alta de activos con autocompletado desde TradingView
  niveles.html    Reglas de cruce (Niveles de Importancia)
  medias.html     Medias de referencia (tendencia del panel)
  ajustes.html    Timeframes vigilados y canales de notificación
  functions/api/  Funciones que sirven los datos al panel

mcp/        Servidor MCP — usa el Monitor de Cruces desde Claude Desktop/Code
  README.md       Cómo configurarlo
```

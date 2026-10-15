# MCP del Monitor de Cruces

Servidor MCP que expone tu Monitor de Cruces (activos, alertas, reglas,
ajustes) como herramientas que Claude puede usar directamente — sin abrir la
web. Se conecta a la misma base de datos de Turso que ya usa GitHub Actions.

## Instalación

```
cd mcp
npm install
```

Crea un fichero `.env` en esta carpeta (copia el de `server/.env.example` si
quieres, solo hacen falta estas dos líneas):

```
TURSO_DATABASE_URL=libsql://tu-base-de-datos.turso.io
TURSO_AUTH_TOKEN=el_token_que_ya_usas
```

## Configurarlo en Claude Desktop

Edita el fichero de configuración de Claude Desktop:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Añade (o combina con lo que ya tengas):

```json
{
  "mcpServers": {
    "monitor-cruces": {
      "command": "node",
      "args": ["RUTA_COMPLETA_A_TU_PROYECTO/mcp/index.js"],
      "env": {
        "TURSO_DATABASE_URL": "libsql://tu-base-de-datos.turso.io",
        "TURSO_AUTH_TOKEN": "el_token_que_ya_usas"
      }
    }
  }
}
```

Sustituye `RUTA_COMPLETA_A_TU_PROYECTO` por la ruta real en tu PC (ej.
`C:\Users\TuNombre\Documentos\monitor-cruces\mcp\index.js` en Windows, con
doble barra invertida `\\` si escribes la ruta a mano en JSON). Reinicia
Claude Desktop y el Monitor de Cruces aparecerá como herramientas
disponibles.

## Configurarlo en Claude Code

```
claude mcp add monitor-cruces -- node RUTA_COMPLETA_A_TU_PROYECTO/mcp/index.js
```

(o edita `.mcp.json` en la raíz del proyecto siguiendo el mismo formato de
arriba).

## Herramientas disponibles

| Herramienta | Qué hace |
|---|---|
| `listar_alertas_activas` | Cruces de las últimas 36h, con precio/RSI/tendencia. Filtrable por timeframe. |
| `listar_historico_alertas` | Alertas ya archivadas, paginado. |
| `eliminar_alerta` | Borra una alerta concreta. |
| `listar_activos` | Universo de activos (todos, o solo los Activos). |
| `buscar_simbolo_tradingview` | Busca el símbolo exacto en TradingView antes de dar de alta un activo. |
| `dar_alta_activo` | Añade un activo nuevo al universo. |
| `activar_desactivar_activo` | Activa/desactiva un activo sin borrarlo. |
| `listar_niveles_importancia` | Reglas de cruce, activas e inactivas. |
| `crear_nivel_importancia` | Da de alta o actualiza una regla. |
| `activar_desactivar_nivel_importancia` | Activa/desactiva una regla sin borrarla. |
| `eliminar_nivel_importancia` | Borra una regla. |
| `obtener_medias_config` / `actualizar_media_config` | Las 4 medias de referencia (tendencia del panel). |
| `obtener_ajustes` | Timeframes vigilados, RSI, canales de notificación. |
| `actualizar_timeframe` | Activa/desactiva vigilancia o visualización de un timeframe. |
| `actualizar_canal_notificacion` | Enciende/apaga Telegram o Email. |
| `actualizar_rsi_panel` | Muestra/oculta el RSI en el panel. |

## Qué NO hace (a propósito)

No incluye una herramienta para "ejecutar el ciclo de vigilancia ahora": eso
implica abrir docenas de conexiones a TradingView y puede tardar varios
minutos — mejor dejarlo al workflow de GitHub Actions (`Run workflow` manual)
o a `npm run ciclo` en local, no a una herramienta conversacional.

## Probarlo sin Claude Desktop

```
cd mcp
npm start
```

Se queda esperando en modo stdio (es normal que no imprima nada más aparte
del mensaje de arranque) — así es como lo habla Claude Desktop/Code por
detrás.

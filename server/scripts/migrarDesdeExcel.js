/**
 * Migracion unica: lee tu Monitor_Cruces_Medias_Moviles.xlsx original y traslada
 * a la base de datos nueva: Universo_Activos, la configuracion de medias moviles,
 * y las reglas de Niveles_Importancia. Es seguro ejecutarlo mas de una vez
 * (usa upsert / ignora duplicados por tv_symbol o por regla).
 *
 * Uso:  npm run migrar-desde-excel -- ./Monitor_Cruces_Medias_Moviles.xlsx
 */
require('dotenv').config();
const path = require('path');
const ExcelJS = require('exceljs');
const { aplicarEsquema } = require('../db/cliente');
const repo = require('../db/repositorio');

const RUTA_XLSX = process.argv[2] || path.join(__dirname, '..', '..', 'Monitor_Cruces_Medias_Moviles.xlsx');
const RUTA_SIMBOLOS = path.join(__dirname, '..', 'config', 'simbolosTradingView.json');

function valorPlano(v) {
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  return v;
}

// El Excel original solo maneja 15/30/60/240 minutos como "de negocio"; la BD
// nueva usa codigos cortos (15, 30, 60, 240, '1D').
const TF_EXCEL_A_CODIGO = {
  '15 min': '15', '30 min': '30', '1 hora': '60', '4 horas': '240', Diario: '1D',
};

async function migrarUniversoYSimbolos(wb) {
  const simbolos = require(RUTA_SIMBOLOS);
  const ws = wb.getWorksheet('Universo_Activos');
  let fila = 3; // fila 1 = nota, fila 2 = cabecera
  let creados = 0;
  let omitidos = 0;
  while (true) {
    const nombre = valorPlano(ws.getCell(fila, 3).value);
    if (!nombre) break;
    const estado = valorPlano(ws.getCell(fila, 8).value);
    const tvSymbol = simbolos[nombre];
    if (estado === 'Activo' && tvSymbol) {
      // eslint-disable-next-line no-await-in-loop
      await repo.crearActivo({
        categoria: valorPlano(ws.getCell(fila, 1).value),
        mercado: valorPlano(ws.getCell(fila, 2).value),
        nombre,
        ticker: valorPlano(ws.getCell(fila, 4).value),
        isin: valorPlano(ws.getCell(fila, 5).value),
        divisa: valorPlano(ws.getCell(fila, 6).value),
        tvSymbol,
        estado: 'Activo',
      }).catch((err) => {
        if (!/UNIQUE/.test(err.message)) throw err;
        omitidos += 1;
      });
      creados += 1;
    } else if (estado === 'Activo' && !tvSymbol) {
      console.log(`  (omitido, sin simbolo TradingView mapeado): ${nombre}`);
      omitidos += 1;
    }
    fila += 1;
  }
  console.log(`Universo_Activos: ${creados} activos migrados, ${omitidos} omitidos.`);
}

async function main() {
  await aplicarEsquema();
  console.log(`Leyendo ${RUTA_XLSX} ...`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(RUTA_XLSX);

  // --- Universo_Activos ---
  await migrarUniversoYSimbolos(wb);

  // --- Medias moviles (C5:D8 de Monitorizacion) ---
  const { db } = require('../db/cliente');
  const wsMon = wb.getWorksheet('Monitorizacion');
  for (let pos = 1; pos <= 4; pos += 1) {
    const fila = 4 + pos;
    const tipo = String(valorPlano(wsMon.getCell(fila, 3).value)).trim();
    const periodo = Number(valorPlano(wsMon.getCell(fila, 4).value));
    // eslint-disable-next-line no-await-in-loop
    await db.execute({
      sql: `INSERT INTO config_medias (posicion, tipo, periodo) VALUES (?, ?, ?)
            ON CONFLICT(posicion) DO UPDATE SET tipo = excluded.tipo, periodo = excluded.periodo`,
      args: [pos, tipo, periodo],
    });
  }
  console.log('config_medias: 4 medias migradas (MA1=rapida/MA2=lenta se usan para la tendencia del panel).');

  // --- Timeframes por defecto (los 5 visibles, vigilando cruces en todos) ---
  const timeframesPorDefecto = [
    ['15', '15m'], ['30', '30m'], ['60', '1h'], ['240', '4h'], ['1D', '1D'],
  ];
  for (const [tf, etiqueta] of timeframesPorDefecto) {
    // eslint-disable-next-line no-await-in-loop
    await db.execute({
      sql: `INSERT INTO config_timeframes (timeframe, etiqueta, vigilar_cruces, mostrar_en_panel) VALUES (?, ?, 1, 1)
            ON CONFLICT(timeframe) DO NOTHING`,
      args: [tf, etiqueta],
    });
  }

  // --- Interruptor de RSI (activado por defecto) ---
  await repo.fijarConfigGeneral('mostrar_rsi', 'true');

  // --- Niveles_Importancia -> reglas de cruce Media/Media (se ignoran las de Vela) ---
  const wsNiv = wb.getWorksheet('Niveles_Importancia');
  let fila = 3;
  let reglasCreadas = 0;
  let reglasIgnoradasVela = 0;
  while (fila <= 60) {
    const nivel = valorPlano(wsNiv.getCell(fila, 1).value);
    const elem1 = valorPlano(wsNiv.getCell(fila, 3).value);
    const elem2 = valorPlano(wsNiv.getCell(fila, 5).value);
    const tfExcel = valorPlano(wsNiv.getCell(fila, 6).value);
    if (nivel !== null && nivel !== undefined && elem1 && elem2 && tfExcel) {
      if (String(elem1).trim().toLowerCase() === 'vela') {
        reglasIgnoradasVela += 1;
      } else {
        const tfCodigo = TF_EXCEL_A_CODIGO[tfExcel] || tfExcel;
        // eslint-disable-next-line no-await-in-loop
        await db.execute({
          sql: `INSERT INTO niveles_importancia (media_rapida, media_lenta, timeframe, nivel)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(media_rapida, media_lenta, timeframe) DO UPDATE SET nivel = excluded.nivel`,
          args: [elem1, elem2, tfCodigo, nivel],
        });
        reglasCreadas += 1;
      }
    }
    fila += 1;
  }
  console.log(`niveles_importancia: ${reglasCreadas} reglas Media/Media migradas, ${reglasIgnoradasVela} reglas de Vela ignoradas (ya no se avisan).`);

  console.log('\nMigracion completada.');
  console.log('IMPORTANTE: revisa que las medias que usan tus reglas de Niveles_Importancia');
  console.log('coincidan con las que realmente calculas (ver aviso en el mensaje del chat).');
}

main().catch((err) => {
  console.error('ERROR en la migracion:', err);
  process.exit(1);
});

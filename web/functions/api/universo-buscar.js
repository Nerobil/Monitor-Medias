import { jsonOk, jsonError } from '../_lib/db.js';

/**
 * Autocompletado de Universo_Activos: busca simbolos en TradingView por texto
 * libre (nombre o ticker) y devuelve candidatos listos para dar de alta.
 * Replica la llamada HTTP que usa la libreria @mathieuc/tradingview
 * (searchMarketV3), sin depender de esa libreria (no es compatible con el
 * runtime de Cloudflare Workers porque usa websockets/Node puro).
 */
export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const texto = (url.searchParams.get('q') || '').trim();
    const filtro = url.searchParams.get('tipo') || '';
    if (!texto) return jsonOk({ resultados: [] });

    const partes = texto.toUpperCase().replace(/ /g, '+').split(':');
    const exchange = partes.length === 2 ? partes[0] : undefined;
    const busqueda = partes[partes.length - 1];

    const params = new URLSearchParams({ text: busqueda, search_type: filtro, start: '0' });
    if (exchange) params.set('exchange', exchange);

    const resp = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3?${params.toString()}`, {
      headers: { origin: 'https://www.tradingview.com' },
    });
    if (!resp.ok) return jsonError(`TradingView respondio ${resp.status}`, 502);
    const data = await resp.json();

    const resultados = (data.symbols || []).map((s) => {
      const exch = s.exchange.split(' ')[0];
      const id = s.prefix ? `${s.prefix}:${s.symbol}` : `${exch.toUpperCase()}:${s.symbol}`;
      return {
        tvSymbol: id,
        mercado: s.exchange,
        nombre: (s.description || '').replace(/<\/?em>/g, ''),
        categoria: s.type,
        ticker: s.symbol,
      };
    });

    return jsonOk({ resultados });
  } catch (err) {
    return jsonError(err.message);
  }
}

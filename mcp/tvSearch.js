/**
 * Busqueda de simbolos de TradingView via HTTP directo, sin depender de la
 * libreria @mathieuc/tradingview (websockets, mas pesada de lo necesario
 * solo para buscar). Misma logica que usa la Function de Cloudflare
 * web/functions/api/universo-buscar.js.
 */
async function buscarSimboloHTTP(texto, filtro = '') {
  const limpio = (texto || '').trim();
  if (!limpio) return [];

  const partes = limpio.toUpperCase().replace(/ /g, '+').split(':');
  const exchange = partes.length === 2 ? partes[0] : undefined;
  const busqueda = partes[partes.length - 1];

  const params = new URLSearchParams({ text: busqueda, search_type: filtro || '', start: '0' });
  if (exchange) params.set('exchange', exchange);

  const resp = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3?${params.toString()}`, {
    headers: { origin: 'https://www.tradingview.com' },
  });
  if (!resp.ok) throw new Error(`TradingView respondio ${resp.status}`);
  const data = await resp.json();

  return (data.symbols || []).map((s) => {
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
}

module.exports = { buscarSimboloHTTP };

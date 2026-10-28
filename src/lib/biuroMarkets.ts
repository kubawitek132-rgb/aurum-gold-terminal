/** Public spot prices only. This module never reads account keys or submits orders. */
export type MarketSymbol = 'BTC' | 'ETH' | 'SOL' | 'DOGE' | 'XRP' | 'LINK';
export type ExchangeId = 'coinbase' | 'kraken';
export type MarketErrorCode = 'http' | 'network' | 'timeout' | 'invalid_response' | 'upstream_error' | 'stale' | 'future_timestamp';

export interface MarketAsset {
  symbol: MarketSymbol;
  pair: `${MarketSymbol}/USD`;
  priceUsd: number;
  change24hPct?: number;
  source: ExchangeId;
  sourceUrl: string;
  /** Trade timestamp supplied by the exchange, never the local fetch time. */
  observedAt: string;
  fetchedAt: string;
}

export interface ExchangeStatus {
  id: ExchangeId;
  name: string;
  status: 'connected' | 'unavailable';
  /** Only pairs with valid, fresh prices are included. */
  pairs: string[];
  latencyMs: number;
  fetchedAt: string;
  observedAt?: string;
  error?: string;
  errors?: { pair: string; code: MarketErrorCode; message: string }[];
}

export interface BiuroMarkets {
  asOf: string;
  mode: 'market-data';
  tradingEnabled: false;
  assets: MarketAsset[];
  exchanges: ExchangeStatus[];
}

export type BiuroMarketsSnapshot = BiuroMarkets;

export const MARKET_MAX_AGE_MS = 120_000;
export const MARKET_FUTURE_TOLERANCE_MS = 30_000;
export const MARKET_REQUEST_TIMEOUT_MS = 5_000;
export const MARKET_CACHE_TTL_MS = 5_000;

type Quote = { priceUsd: number; observedAt: string };
type Dependencies = { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number };
export const MARKET_SYMBOLS: MarketSymbol[] = ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'LINK'];
const KRAKEN_PAIRS: Record<MarketSymbol, { request: string; keys: string[] }> = {
  BTC: { request: 'XBTUSD', keys: ['XXBTZUSD', 'XBTUSD', 'BTC/USD'] },
  ETH: { request: 'ETHUSD', keys: ['XETHZUSD', 'ETHUSD', 'ETH/USD'] },
  SOL: { request: 'SOLUSD', keys: ['SOLUSD', 'SOL/USD'] },
  DOGE: { request: 'XDGUSD', keys: ['XDGUSD', 'DOGE/USD'] },
  XRP: { request: 'XRPUSD', keys: ['XXRPZUSD', 'XRPUSD', 'XRP/USD'] },
  LINK: { request: 'LINKUSD', keys: ['LINKUSD', 'LINK/USD'] },
};
const EXCHANGES: { id: ExchangeId; name: string }[] = [
  { id: 'coinbase', name: 'Coinbase Exchange' },
  { id: 'kraken', name: 'Kraken' },
];

class MarketError extends Error {
  constructor(readonly code: MarketErrorCode, message: string) {
    super(message);
    this.name = 'MarketError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MarketError('invalid_response', 'Nieprawidłowy format odpowiedzi giełdy.');
  }
  return value as Record<string, unknown>;
}

function positiveNumber(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) {
    throw new MarketError('invalid_response', 'Brak poprawnej dodatniej wartości.');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new MarketError('invalid_response', 'Brak poprawnej dodatniej wartości.');
  }
  return parsed;
}

function tradeTime(timestampMs: number, nowMs: number): string {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0 || timestampMs > 8.64e15) {
    throw new MarketError('invalid_response', 'Brak poprawnego czasu transakcji.');
  }
  if (nowMs - timestampMs > MARKET_MAX_AGE_MS) {
    throw new MarketError('stale', 'Ostatnia transakcja jest starsza niż 120 sekund.');
  }
  if (timestampMs - nowMs > MARKET_FUTURE_TOLERANCE_MS) {
    throw new MarketError('future_timestamp', 'Czas transakcji wyprzedza zegar serwera.');
  }
  return new Date(timestampMs).toISOString();
}

export function parseCoinbaseTicker(payload: unknown, nowMs: number): Quote {
  const data = record(payload);
  if (typeof data.time !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(data.time)) {
    throw new MarketError('invalid_response', 'Brak poprawnego czasu transakcji Coinbase.');
  }
  return { priceUsd: positiveNumber(data.price), observedAt: tradeTime(Date.parse(data.time), nowMs) };
}

export function parseKrakenTrades(payload: unknown, symbol: MarketSymbol, nowMs: number): Quote {
  const data = record(payload);
  if (!Array.isArray(data.error)) throw new MarketError('invalid_response', 'Brak statusu odpowiedzi Kraken.');
  // Kraken may return an API error even when HTTP status is 200.
  if (data.error.length) throw new MarketError('upstream_error', 'Kraken zgłasza błąd API.');
  const result = record(data.result);
  const keys = KRAKEN_PAIRS[symbol]?.keys;
  if (!keys) throw new MarketError('invalid_response', 'Nieobsługiwana para Kraken.');
  const trades = keys.map((key) => result[key]).find(Array.isArray);
  if (!Array.isArray(trades) || !trades.length) throw new MarketError('invalid_response', 'Brak transakcji dla żądanej pary Kraken.');
  // The documented trades are oldest first. Do not use result.last: it is a cursor.
  const last = trades[trades.length - 1];
  if (!Array.isArray(last) || last.length < 3) throw new MarketError('invalid_response', 'Nieprawidłowa transakcja Kraken.');
  return { priceUsd: positiveNumber(last[0]), observedAt: tradeTime(positiveNumber(last[2]) * 1000, nowMs) };
}

function sourceUrl(exchange: ExchangeId, symbol: MarketSymbol): string {
  return exchange === 'coinbase'
    ? `https://api.exchange.coinbase.com/products/${symbol}-USD/ticker`
    : `https://api.kraken.com/0/public/Trades?pair=${KRAKEN_PAIRS[symbol].request}&count=1`;
}

async function requestQuote(exchange: ExchangeId, symbol: MarketSymbol, fetcher: typeof fetch, now: () => number, timeoutMs: number): Promise<MarketAsset> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = sourceUrl(exchange, symbol);
  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new MarketError('http', `Giełda zwróciła HTTP ${response.status}.`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw new MarketError('timeout', 'Przekroczono czas odpowiedzi giełdy.');
      throw new MarketError('invalid_response', 'Odpowiedź giełdy nie jest poprawnym JSON.');
    }
    const fetchedMs = now();
    const quote = exchange === 'coinbase' ? parseCoinbaseTicker(payload, fetchedMs) : parseKrakenTrades(payload, symbol, fetchedMs);
    return { symbol, pair: `${symbol}/USD`, ...quote, source: exchange, sourceUrl: url, fetchedAt: new Date(fetchedMs).toISOString() };
  } catch (error) {
    if (controller.signal.aborted) throw new MarketError('timeout', 'Przekroczono czas odpowiedzi giełdy.');
    if (error instanceof MarketError) throw error;
    throw new MarketError('network', 'Nie można połączyć się z publicznym API giełdy.');
  } finally {
    clearTimeout(timeout);
  }
}

/** Both exchanges are checked independently; a failure never creates a synthetic price. */
export async function loadBiuroMarkets(dependencies: Dependencies = {}): Promise<BiuroMarkets> {
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? MARKET_REQUEST_TIMEOUT_MS;
  const results = await Promise.all(EXCHANGES.map(async (exchange) => {
    const started = now();
    const outcomes = await Promise.allSettled(MARKET_SYMBOLS.map((symbol) => requestQuote(exchange.id, symbol, fetcher, now, timeoutMs)));
    const quotes: MarketAsset[] = [];
    const errors: NonNullable<ExchangeStatus['errors']> = [];
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') quotes.push(outcome.value);
      else {
        const error = outcome.reason instanceof MarketError ? outcome.reason : new MarketError('network', 'Źródło danych jest niedostępne.');
        errors.push({ pair: `${MARKET_SYMBOLS[index]}/USD`, code: error.code, message: error.message });
      }
    });
    const finished = now();
    const status: ExchangeStatus = {
      ...exchange,
      status: quotes.length ? 'connected' : 'unavailable',
      pairs: quotes.map((quote) => quote.pair),
      latencyMs: Math.max(0, finished - started),
      fetchedAt: new Date(finished).toISOString(),
      ...(quotes.length ? { observedAt: quotes.map((quote) => quote.observedAt).sort()[0] } : {}),
      ...(errors.length ? { error: errors.map((error) => `${error.pair}: ${error.message}`).join(' '), errors } : {}),
    };
    return { quotes, status };
  }));
  const asOfMs = now();
  // Another provider may have taken the full timeout after this quote arrived.
  // Recheck at assembly, so that a receipt timestamp never disguises old trades.
  for (const result of results) {
    const errors = result.status.errors ?? [];
    result.quotes = result.quotes.filter((quote) => {
      try { tradeTime(Date.parse(quote.observedAt), asOfMs); return true; }
      catch (error) {
        if (error instanceof MarketError) errors.push({ pair: quote.pair, code: error.code, message: error.message });
        return false;
      }
    });
    result.status.status = result.quotes.length ? 'connected' : 'unavailable';
    result.status.pairs = result.quotes.map((quote) => quote.pair);
    if (result.quotes.length) result.status.observedAt = result.quotes.map((quote) => quote.observedAt).sort()[0];
    else delete result.status.observedAt;
    if (errors.length) {
      result.status.errors = errors;
      result.status.error = errors.map((error) => `${error.pair}: ${error.message}`).join(' ');
    }
  }
  // Stable preference is per asset: one missing quote does not discard other pairs.
  const assets = MARKET_SYMBOLS.flatMap((symbol) => {
    const quote = results.flatMap((result) => result.quotes).find((candidate) => candidate.symbol === symbol);
    return quote ? [quote] : [];
  });
  return { asOf: new Date(asOfMs).toISOString(), mode: 'market-data', tradingEnabled: false, assets, exchanges: results.map((result) => result.status) };
}

/** Per server instance: coalesce visitors, preserve source times, never serve expired data. */
export function createBiuroMarketsCache(
  loader: () => Promise<BiuroMarkets> = loadBiuroMarkets,
  options: { now?: () => number; ttlMs?: number } = {},
): () => Promise<BiuroMarkets> {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? MARKET_CACHE_TTL_MS;
  let cached: { snapshot: BiuroMarkets; expiresAt: number } | undefined;
  let inflight: Promise<BiuroMarkets> | undefined;
  return async () => {
    const nowMs = now();
    const observations = cached ? [
      ...cached.snapshot.assets.map((asset) => asset.observedAt),
      ...cached.snapshot.exchanges.flatMap((exchange) => exchange.observedAt ? [exchange.observedAt] : []),
    ] : [];
    const stillFresh = observations.every((value) => {
      const at = Date.parse(value);
      return Number.isFinite(at) && nowMs - at <= MARKET_MAX_AGE_MS && at - nowMs <= MARKET_FUTURE_TOLERANCE_MS;
    });
    if (cached && nowMs < cached.expiresAt && stillFresh) return cached.snapshot;
    if (inflight) return inflight;
    inflight = Promise.resolve().then(loader).then((snapshot) => {
      cached = { snapshot, expiresAt: now() + ttlMs };
      return snapshot;
    }).finally(() => { inflight = undefined; });
    return inflight;
  };
}

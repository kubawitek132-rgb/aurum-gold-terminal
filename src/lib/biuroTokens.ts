/** Read-only pair discovery from the official public DEX Screener search API. */
export type TokenChainFilter = 'all' | 'solana';
export type TokenSearchErrorCode = 'invalid_query' | 'invalid_chain' | 'http' | 'network' | 'timeout' | 'invalid_response' | 'busy';

export interface TokenPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url: string;
  baseAddress: string;
  name: string;
  symbol: string;
  quoteSymbol: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

export interface BiuroTokensSnapshot {
  query: string;
  chain: TokenChainFilter;
  source: 'dexscreener';
  /** API receipt time. The search API does not provide a quote timestamp. */
  fetchedAt: string;
  tradingEnabled: false;
  pairs: TokenPair[];
}

type Dependencies = { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number };
export const TOKEN_SEARCH_TIMEOUT_MS = 5_000;
export const TOKEN_SEARCH_CACHE_MS = 5_000;
export const TOKEN_SEARCH_MAX_RESULTS = 6;
const MAX_CACHE_ENTRIES = 16;
const SEARCH_ENDPOINT = 'https://api.dexscreener.com/latest/dex/search';

export class TokenSearchError extends Error {
  constructor(readonly code: TokenSearchErrorCode, message: string) {
    super(message);
    this.name = 'TokenSearchError';
  }
}

export function validateTokenSearch(query: unknown, chain: unknown = 'all'): { query: string; chain: TokenChainFilter } {
  if (typeof query !== 'string') throw new TokenSearchError('invalid_query', 'Wpisz symbol lub adres kontraktu (2–64 znaki).');
  const normalized = query.trim().replace(/ +/g, ' ');
  // Symbols, pair names and common EVM / Solana contract addresses only.
  if (normalized.length < 2 || normalized.length > 64 || !/^[A-Za-z0-9$][A-Za-z0-9 ._/$()-]*$/.test(normalized)) {
    throw new TokenSearchError('invalid_query', 'Wpisz symbol lub adres kontraktu (2–64 znaki), bez linków.');
  }
  if (chain !== 'all' && chain !== 'solana') throw new TokenSearchError('invalid_chain', 'Wybierz wszystkie sieci albo Solanę.');
  return { query: normalized, chain };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return result && result.length <= max ? result : null;
}

function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function price(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Keep the exact upstream pair URL, and reject non-pair / non-DEX Screener links. */
export function dexScreenerPairUrl(value: unknown, chainId?: string): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'dexscreener.com' || url.port || url.username || url.password || url.search || url.hash || value !== url.href) return null;
    const match = /^\/([a-z0-9-]+)\/([A-Za-z0-9-]+)\/?$/.exec(url.pathname);
    if (!match || (chainId && match[1] !== chainId)) return null;
    return value;
  } catch { return null; }
}

export function parseDexScreenerPairs(payload: unknown, chain: TokenChainFilter): TokenPair[] {
  const data = record(payload);
  if (!data || !Array.isArray(data.pairs)) throw new TokenSearchError('invalid_response', 'DEX Screener zwrócił nieprawidłowe dane.');
  const pairs: TokenPair[] = [];
  const seen = new Set<string>();
  for (const value of data.pairs.slice(0, 100)) {
    const pair = record(value);
    if (!pair) continue;
    const chainId = text(pair.chainId, 32);
    if (!chainId || !/^[a-z0-9-]+$/.test(chainId) || (chain === 'solana' && chainId !== 'solana')) continue;
    const dexId = text(pair.dexId, 40);
    const pairAddress = text(pair.pairAddress, 128);
    const url = dexScreenerPairUrl(pair.url, chainId);
    const base = record(pair.baseToken);
    const quote = record(pair.quoteToken);
    const baseAddress = text(base?.address, 128);
    const name = text(base?.name, 100);
    const symbol = text(base?.symbol, 32);
    const quoteSymbol = text(quote?.symbol, 32);
    if (!dexId || !pairAddress || !url || !baseAddress || !name || !symbol || !quoteSymbol) continue;
    const key = `${chainId}:${pairAddress}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ chainId, dexId, pairAddress, url, baseAddress, name, symbol, quoteSymbol, priceUsd: price(pair.priceUsd), liquidityUsd: nonnegative(record(pair.liquidity)?.usd), volume24hUsd: nonnegative(record(pair.volume)?.h24) });
  }
  return pairs.sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1) || (b.volume24hUsd ?? -1) - (a.volume24hUsd ?? -1)).slice(0, TOKEN_SEARCH_MAX_RESULTS);
}

export async function loadBiuroTokens(query: unknown, chain: unknown = 'all', dependencies: Dependencies = {}): Promise<BiuroTokensSnapshot> {
  const validated = validateTokenSearch(query, chain);
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? TOKEN_SEARCH_TIMEOUT_MS);
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', validated.query);
  try {
    const response = await fetcher(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new TokenSearchError('http', `DEX Screener jest chwilowo niedostępny (HTTP ${response.status}).`);
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new TokenSearchError('invalid_response', 'DEX Screener zwrócił nieprawidłowe dane.'); }
    const pairs = parseDexScreenerPairs(payload, validated.chain);
    return { ...validated, source: 'dexscreener', fetchedAt: new Date(now()).toISOString(), tradingEnabled: false, pairs };
  } catch (error) {
    if (controller.signal.aborted) throw new TokenSearchError('timeout', 'DEX Screener nie odpowiedział na czas. Spróbuj ponownie.');
    if (error instanceof TokenSearchError) throw error;
    throw new TokenSearchError('network', 'Nie można pobrać danych DEX Screener. Spróbuj ponownie.');
  } finally { clearTimeout(timeout); }
}

/** Bounded five-second cache; identical concurrent searches share one request. */
export function createTokenSearchService(dependencies: Dependencies = {}) {
  const now = dependencies.now ?? Date.now;
  const entries = new Map<string, { expiresAt: number; promise: Promise<BiuroTokensSnapshot>; pending: boolean }>();
  return async (query: unknown, chain: unknown = 'all'): Promise<BiuroTokensSnapshot> => {
    const validated = validateTokenSearch(query, chain);
    const key = `${validated.chain}:${validated.query}`;
    const time = now();
    for (const [entryKey, entry] of entries) if (!entry.pending && entry.expiresAt <= time) entries.delete(entryKey);
    const cached = entries.get(key);
    if (cached) return cached.promise;
    if (entries.size >= MAX_CACHE_ENTRIES) {
      const completed = [...entries].find(([, entry]) => !entry.pending);
      if (completed) entries.delete(completed[0]);
      else throw new TokenSearchError('busy', 'Trwa wiele wyszukiwań. Spróbuj ponownie za chwilę.');
    }
    const entry = { expiresAt: 0, pending: true, promise: null as unknown as Promise<BiuroTokensSnapshot> };
    entry.promise = loadBiuroTokens(validated.query, validated.chain, dependencies).then(result => {
      entry.pending = false;
      entry.expiresAt = now() + TOKEN_SEARCH_CACHE_MS;
      return result;
    }, error => { entries.delete(key); throw error; });
    entries.set(key, entry);
    return entry.promise;
  };
}

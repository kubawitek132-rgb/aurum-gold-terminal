import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBiuroMarketsCache, loadBiuroMarkets, parseCoinbaseTicker, parseKrakenTrades, MARKET_MAX_AGE_MS, type MarketSymbol } from '@/lib/biuroMarkets';
import { GET } from '@/app/api/biuro/markets/route';

const NOW = Date.parse('2026-10-28T09:00:00.000Z');
const observed = new Date(NOW - 1000).toISOString();
const coinbase = (price = '81000.50', time = observed) => ({ price, time });
const kraken = (key: string, price = '81001.00', at = (NOW - 2000) / 1000) => ({ error: [], result: { [key]: [[price, '0.2', at, 'b', 'm', '', 42]], last: '9999999999999999999' } });
const json = (data: unknown, status = 200) => Response.json(data, { status });
const expectCode = (code: string) => (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === code;

test('exchange timestamps remain distinct from receipt time and Kraken cursor', () => {
  assert.deepEqual(parseCoinbaseTicker(coinbase(), NOW), { priceUsd: 81000.5, observedAt: observed });
  assert.deepEqual(parseKrakenTrades(kraken('XXBTZUSD'), 'BTC', NOW), { priceUsd: 81001, observedAt: new Date(NOW - 2000).toISOString() });
  assert.equal(parseKrakenTrades(kraken('ETH/USD', '2300.25'), 'ETH', NOW).priceUsd, 2300.25);
  assert.equal(parseKrakenTrades(kraken('SOLUSD', '102.49'), 'SOL', NOW).priceUsd, 102.49);
  assert.equal(parseKrakenTrades(kraken('XDGUSD', '0.08011'), 'DOGE', NOW).priceUsd, 0.08011);
  assert.equal(parseKrakenTrades(kraken('XXRPZUSD', '1.3292'), 'XRP', NOW).priceUsd, 1.3292);
  assert.equal(parseKrakenTrades(kraken('LINKUSD', '11.798'), 'LINK', NOW).priceUsd, 11.798);
  assert.throws(() => parseKrakenTrades(kraken('XETHZUSD'), 'BTC', NOW), expectCode('invalid_response'));
  assert.throws(() => parseKrakenTrades(kraken('XETHZUSD'), 'SOL', NOW), expectCode('invalid_response'));
  assert.throws(() => parseKrakenTrades(kraken('SOLUSD'), 'UNKNOWN' as MarketSymbol, NOW), expectCode('invalid_response'));
});

test('malformed, non-finite and nonpositive prices are rejected instead of coerced', () => {
  for (const price of [null, '', ' ', 'NaN', 'Infinity', '-1', '0', '12USD', '1e309', [], false, Infinity]) {
    assert.throws(() => parseCoinbaseTicker({ price, time: observed }, NOW), expectCode('invalid_response'));
  }
  assert.throws(() => parseCoinbaseTicker({ price: '1', time: 'today' }, NOW), expectCode('invalid_response'));
  assert.throws(() => parseKrakenTrades({ error: ['EGeneral:Unavailable'], result: {} }, 'BTC', NOW), expectCode('upstream_error'));
  assert.throws(() => parseKrakenTrades({ result: { XXBTZUSD: [] } }, 'BTC', NOW), expectCode('invalid_response'));
});

test('stale and future timestamps are not treated as a new quote when fetched now', () => {
  assert.throws(() => parseCoinbaseTicker(coinbase('81000', new Date(NOW - MARKET_MAX_AGE_MS - 1).toISOString()), NOW), expectCode('stale'));
  assert.throws(() => parseKrakenTrades(kraken('XXBTZUSD', '81000', (NOW + 31_000) / 1000), 'BTC', NOW), expectCode('future_timestamp'));
  assert.equal(parseCoinbaseTicker(coinbase('81000', new Date(NOW - MARKET_MAX_AGE_MS).toISOString()), NOW).priceUsd, 81000);
});

test('fails over each pair independently and exposes the actual source and partial outage', async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.method, 'GET');
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    if (url.includes('coinbase.com/products/BTC')) return json(coinbase('80000', new Date(NOW - 180_000).toISOString()));
    if (url.includes('coinbase.com/products/ETH')) return json(coinbase('2300'));
    if (url.includes('coinbase.com/products/DOGE')) return json(coinbase('0.08'));
    if (url.includes('coinbase.com')) return json({}, 503);
    if (url.includes('pair=XBTUSD')) return json(kraken('XXBTZUSD', '81001'));
    if (url.includes('pair=SOLUSD')) return json(kraken('SOLUSD', '102.49'));
    if (url.includes('pair=XRPUSD')) return json(kraken('XXRPZUSD', '1.33'));
    return json({ error: ['EService:Unavailable'] });
  };
  const data = await loadBiuroMarkets({ fetcher, now: () => NOW });
  assert.equal(requests.length, 12);
  assert.deepEqual(data.assets.map(({ symbol, source, priceUsd }) => ({ symbol, source, priceUsd })), [
    { symbol: 'BTC', source: 'kraken', priceUsd: 81001 },
    { symbol: 'ETH', source: 'coinbase', priceUsd: 2300 },
    { symbol: 'SOL', source: 'kraken', priceUsd: 102.49 },
    { symbol: 'DOGE', source: 'coinbase', priceUsd: 0.08 },
    { symbol: 'XRP', source: 'kraken', priceUsd: 1.33 },
  ]);
  assert.match(data.assets[0].sourceUrl, /^https:\/\/api\.kraken\.com\/0\/public\/Trades/);
  assert.notEqual(data.assets[0].observedAt, data.assets[0].fetchedAt);
  assert.deepEqual(data.exchanges.map((exchange) => exchange.pairs), [['ETH/USD', 'DOGE/USD'], ['BTC/USD', 'SOL/USD', 'XRP/USD']]);
  assert.equal(data.assets.some((asset) => asset.symbol === 'LINK'), false);
  assert.equal(data.exchanges[0].errors?.[0].code, 'stale');
  assert.equal(data.exchanges[1].errors?.[0].code, 'upstream_error');
  assert.equal(data.tradingEnabled, false);
});

test('a responding exchange is preferred consistently, without inventing a 24h change', async () => {
  const fetcher: typeof fetch = async (input) => String(input).includes('coinbase.com')
    ? json(coinbase())
    : json(kraken(String(input).includes('XBTUSD') ? 'XXBTZUSD' : 'XETHZUSD'));
  const data = await loadBiuroMarkets({ fetcher, now: () => NOW });
  assert.deepEqual(data.assets.map((asset) => asset.source), Array(6).fill('coinbase'));
  assert.equal(data.assets.some((asset) => 'change24hPct' in asset), false);
  assert.deepEqual(data.exchanges.map((exchange) => exchange.status), ['connected', 'connected']);
});

test('HTTP failures and invalid JSON produce empty data, never a paper fallback', async () => {
  const fetcher: typeof fetch = async (input) => String(input).includes('coinbase.com')
    ? new Response('<html>unavailable</html>', { status: 502 })
    : new Response('not json', { status: 200 });
  const data = await loadBiuroMarkets({ fetcher, now: () => NOW });
  assert.deepEqual(data.assets, []);
  assert.deepEqual(data.exchanges.map((exchange) => exchange.status), ['unavailable', 'unavailable']);
  assert.equal(data.exchanges[0].errors?.[0].code, 'http');
  assert.equal(data.exchanges[1].errors?.[0].code, 'invalid_response');
});

test('hung requests are aborted and reported as timeouts', async () => {
  let aborted = 0;
  const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      aborted++;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
  const data = await loadBiuroMarkets({ fetcher, now: () => NOW, timeoutMs: 10 });
  assert.equal(aborted, 12);
  assert.deepEqual(data.assets, []);
  assert.ok(data.exchanges.every((exchange) => exchange.errors?.every((error) => error.code === 'timeout')));
});

test('5-second cache coalesces concurrent visitors and preserves original source times', async () => {
  let now = NOW;
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return json(coinbase('100', new Date(now - 1000).toISOString())); };
  const cached = createBiuroMarketsCache(() => loadBiuroMarkets({ fetcher, now: () => now }), { now: () => now });
  const visitors = await Promise.all(Array.from({ length: 20 }, () => cached()));
  assert.equal(requests, 12);
  assert.ok(visitors.every((snapshot) => snapshot === visitors[0]));
  now += 4999;
  const reused = await cached();
  assert.equal(requests, 12);
  assert.equal(reused.asOf, new Date(NOW).toISOString());
  assert.equal(reused.assets[0].observedAt, new Date(NOW - 1000).toISOString());
  now += 1;
  await cached();
  assert.equal(requests, 24);
});

test('cache expiry never serves a quote past its 120-second observation limit', async () => {
  let now = NOW;
  let loads = 0;
  const cached = createBiuroMarketsCache(async () => {
    loads++;
    const observedMs = loads === 1 ? NOW - MARKET_MAX_AGE_MS + 1000 : now - 1000;
    return loadBiuroMarkets({ fetcher: async () => json(coinbase('100', new Date(observedMs).toISOString())), now: () => now });
  }, { now: () => now });
  await cached();
  now += 2000; // Still inside cache TTL, but the original trade has expired.
  const refreshed = await cached();
  assert.equal(loads, 2);
  assert.equal(refreshed.assets[0].observedAt, new Date(now - 1000).toISOString());
});

test('cache coalesces upstream outages too and retries after TTL without stale fallback', async () => {
  let now = NOW;
  let requests = 0;
  const cached = createBiuroMarketsCache(() => loadBiuroMarkets({ fetcher: async () => { requests++; return json({}, 503); }, now: () => now }), { now: () => now });
  const failures = await Promise.all([cached(), cached(), cached()]);
  assert.equal(requests, 12);
  assert.ok(failures.every((snapshot) => snapshot.assets.length === 0));
  now += 5000;
  await cached();
  assert.equal(requests, 24);
});

test('route returns 503 and no-store when all upstreams fail', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const response = await GET();
    assert.equal(response.status, 503);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    const payload = await response.json();
    assert.deepEqual(payload.assets, []);
    assert.equal(payload.tradingEnabled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSearchService, dexScreenerPairUrl, loadBiuroTokens, parseDexScreenerPairs, TOKEN_SEARCH_CACHE_MS, validateTokenSearch } from '@/lib/biuroTokens';
import { GET } from '@/app/api/biuro/tokens/route';

const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const code = (expected: string) => (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === expected;
const pair = (address = 'Pair123', chainId = 'solana', liquidity: number | null = 100_000) => ({
  chainId, dexId: 'raydium', pairAddress: address, url: `https://dexscreener.com/${chainId}/${address}`,
  baseToken: { address: 'TokenContract1234567890', name: 'Example Token', symbol: 'EXAMPLE' },
  quoteToken: { address: 'QuoteContract12345', name: 'USD Coin', symbol: 'USDC' },
  priceUsd: '0.00001234', liquidity: { usd: liquidity }, volume: { h24: 20500 },
});
const json = (data: unknown, status = 200) => Response.json(data, { status });

test('search accepts symbols, pair names and contract addresses while rejecting URLs and invalid filters', () => {
  assert.deepEqual(validateTokenSearch(' SOL/USDC ', 'solana'), { query: 'SOL/USDC', chain: 'solana' });
  assert.equal(validateTokenSearch('So11111111111111111111111111111111111111112').query, 'So11111111111111111111111111111111111111112');
  assert.equal(validateTokenSearch('0x1234567890123456789012345678901234567890', 'all').chain, 'all');
  for (const value of [null, '', 'S', 'a'.repeat(65), 'https://evil.example/path', '//evil.example', 'SOL?url=x', 'SOL\nUSDC', '<script>', 'SOL&chain=eth', 'SOL%20USD']) {
    assert.throws(() => validateTokenSearch(value), code('invalid_query'));
  }
  assert.throws(() => validateTokenSearch('SOL', 'ethereum'), code('invalid_chain'));
});

test('external links retain only exact canonical HTTPS DEX Screener pair URLs', () => {
  const valid = 'https://dexscreener.com/solana/Pair123';
  assert.equal(dexScreenerPairUrl(valid, 'solana'), valid);
  for (const value of ['https://dexscreener.com.evil.test/solana/Pair123', 'https://evil.test/solana/Pair123', 'http://dexscreener.com/solana/Pair123', 'https://user@dexscreener.com/solana/Pair123', 'https://dexscreener.com:444/solana/Pair123', 'javascript:alert(1)', '//dexscreener.com/solana/Pair123', `${valid}?redirect=evil`, `${valid}#x`, 'https://dexscreener.com/evil/../solana/Pair123', 'https://dexscreener.com/solana/Pair%2F123']) {
    assert.equal(dexScreenerPairUrl(value), null, value);
  }
  assert.equal(dexScreenerPairUrl(valid, 'ethereum'), null);
});

test('normalizes real pair fields, filters Solana, deduplicates and limits by liquidity', () => {
  const rows = Array.from({ length: 9 }, (_, i) => pair(`Pair${i}`, i === 8 ? 'ethereum' : 'solana', i * 100));
  const data = parseDexScreenerPairs({ pairs: [...rows, rows[0], { ...pair('Untrusted'), url: 'https://evil.test/pair' }, null] }, 'solana');
  assert.equal(data.length, 6);
  assert.deepEqual(data.map(item => item.pairAddress), ['Pair7', 'Pair6', 'Pair5', 'Pair4', 'Pair3', 'Pair2']);
  assert.ok(data.every(item => item.chainId === 'solana'));
  assert.equal(data[0].priceUsd, 0.00001234);
  assert.equal(data[0].volume24hUsd, 20500);
  assert.equal(data[0].baseAddress, 'TokenContract1234567890');
  assert.equal(parseDexScreenerPairs({ pairs: rows }, 'all')[0].chainId, 'ethereum');
});

test('missing or invalid metrics remain unavailable rather than zero or a fabricated price', () => {
  const data = parseDexScreenerPairs({ pairs: [{ ...pair(), priceUsd: 'NaN', liquidity: { usd: null }, volume: { h24: -1 } }, { ...pair('Other'), priceUsd: '1e309' }] }, 'solana');
  assert.equal(data[0].priceUsd, null);
  assert.equal(data[1].priceUsd, null);
  const missing = data.find(item => item.pairAddress === 'Pair123');
  assert.equal(missing?.liquidityUsd, null);
  assert.equal(missing?.volume24hUsd, null);
  assert.deepEqual(parseDexScreenerPairs({ pairs: [] }, 'all'), []);
  assert.throws(() => parseDexScreenerPairs({ pairs: null }, 'all'), code('invalid_response'));
});

test('upstream stays fixed and encoded, with no keys or redirects; fetchedAt is explicitly receipt time', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.dexscreener.com');
    assert.equal(url.pathname, '/latest/dex/search');
    assert.equal(url.searchParams.get('q'), 'SOL/USDC');
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return json({ pairs: [pair()] });
  };
  const result = await loadBiuroTokens('SOL/USDC', 'solana', { fetcher, now: () => NOW });
  assert.equal(calls, 1);
  assert.equal(result.fetchedAt, new Date(NOW).toISOString());
  assert.equal('observedAt' in result, false);
  assert.equal(result.tradingEnabled, false);
  assert.equal(result.source, 'dexscreener');
  await assert.rejects(() => loadBiuroTokens('https://evil.test', 'all', { fetcher }), code('invalid_query'));
  assert.equal(calls, 1);
});

test('HTTP, malformed payloads and timeouts do not create token results', async () => {
  await assert.rejects(() => loadBiuroTokens('SOL', 'all', { fetcher: async () => new Response(null, { status: 429 }) }), code('http'));
  await assert.rejects(() => loadBiuroTokens('SOL', 'all', { fetcher: async () => new Response('not JSON') }), code('invalid_response'));
  await assert.rejects(() => loadBiuroTokens('SOL', 'all', { fetcher: async () => json({ tokens: [] }) }), code('invalid_response'));
  const fetcher: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(() => loadBiuroTokens('SOL', 'all', { fetcher, timeoutMs: 5 }), code('timeout'));
});

test('five-second cache shares inflight requests, retains receipt time, and expires', async () => {
  let now = NOW;
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const search = createTokenSearchService({ now: () => now, fetcher: async () => { calls++; await gate; return json({ pairs: [pair()] }); } });
  const first = search('SOL', 'solana');
  const second = search('SOL', 'solana');
  release?.();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  now += TOKEN_SEARCH_CACHE_MS - 1;
  assert.equal((await search('SOL', 'solana')).fetchedAt, a.fetchedAt);
  assert.equal(calls, 1);
  now += 2;
  await search('SOL', 'solana');
  assert.equal(calls, 2);
});

test('bounded inflight map rejects excess unique requests instead of growing indefinitely', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const search = createTokenSearchService({ fetcher: async () => { await gate; return json({ pairs: [] }); } });
  const pending = Array.from({ length: 16 }, (_, i) => search(`Token${i}`));
  await assert.rejects(() => search('Overflow'), code('busy'));
  release?.();
  await Promise.all(pending);
  assert.deepEqual((await search('NextToken')).pairs, []);
});

test('route rejects malformed input without fetching and emits no-store for success and errors', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return json({ pairs: [] }); };
    const invalid = await GET(new Request('https://biurohq.com/api/biuro/tokens?q=https%3A%2F%2Fevil.test'));
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    assert.match(invalid.headers.get('cache-control') ?? '', /no-store/);
    const good = await GET(new Request('https://biurohq.com/api/biuro/tokens?q=UniqueRouteToken&chain=solana'));
    assert.equal(good.status, 200);
    assert.deepEqual((await good.json()).pairs, []);
    assert.match(good.headers.get('cache-control') ?? '', /no-store/);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const failure = await GET(new Request('https://biurohq.com/api/biuro/tokens?q=UnavailableRouteToken'));
    assert.equal(failure.status, 503);
    const payload = await failure.json();
    assert.equal(payload.error.code, 'http');
    assert.equal('pairs' in payload, false);
    assert.equal(payload.tradingEnabled, false);
  } finally { globalThis.fetch = original; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached } from '@/lib/cache';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('cache: zimny start → fallback z pending, potem dane, po TTL stara wartość od razu', async () => {
  let n = 0;
  const loader = async () => {
    n++;
    await sleep(n === 1 ? 250 : 100);
    return { data: n, source: 'test' };
  };
  const opts = { ttlMs: 300, firstWaitMs: 50, fallback: () => ({ data: -1, source: 'MOCK' }) };
  const a = await cached('t:swr', loader, opts);
  assert.equal(a.data, -1);
  assert.equal(a.pending, true);
  await sleep(300);
  assert.equal((await cached('t:swr', loader, opts)).data, 1);
  await sleep(350);
  const t0 = Date.now();
  const c = await cached('t:swr', loader, opts);
  assert.equal(c.data, 1); // stara wartość…
  assert.ok(Date.now() - t0 < 50); // …bez czekania na źródło
  await sleep(150);
  assert.equal((await cached('t:swr', loader, opts)).data, 2);
});

test('cache: błąd źródła zostawia ostatnią dobrą wartość jako STALE', async () => {
  let fail = false;
  const loader = async () => {
    if (fail) throw new Error('down');
    return { data: 'ok', source: 'test' };
  };
  const opts = { ttlMs: 50, retryMs: 50 };
  assert.equal((await cached('t:stale', loader, opts)).data, 'ok');
  fail = true;
  await sleep(80);
  await cached('t:stale', loader, opts); // start odświeżenia w tle
  await sleep(20);
  const r = await cached('t:stale', loader, opts);
  assert.equal(r.data, 'ok');
  assert.equal(r.stale, true);
});

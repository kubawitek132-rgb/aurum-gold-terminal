import { test } from 'node:test';
import assert from 'node:assert/strict';
import banks from '@/data/central-banks.json';
import market from '@/data/gold-market.json';
import reserves from '@/data/reserves.json';
import cal from '@/data/gold-calendar.json';
import geo from '@/data/currency-geo.json';

test('banki: poprawne daty UTC, posortowane, waluta ma współrzędne', () => {
  for (const b of banks.banks) {
    for (const m of b.meetings) assert.ok(/Z$/.test(m) && Number.isFinite(Date.parse(m)), `${b.id}: ${m}`);
    assert.deepEqual(b.meetings, [...b.meetings].sort(), `${b.id}: kolejność dat`);
    assert.ok(b.currency in geo, `${b.id}: brak ${b.currency} w currency-geo.json`);
    if (b.lastChange) assert.ok(Number.isFinite(Date.parse(b.lastChange.date)) && b.lastChange.bps !== 0, `${b.id}: lastChange`);
  }
});

test('rynek fizyczny: przepływy i zdarzenia wskazują istniejące huby, kody krajów 3-cyfrowe', () => {
  const hubs = new Set(market.hubs.map((h) => h.id));
  for (const f of market.flows) assert.ok(hubs.has(f.from) && hubs.has(f.to), `${f.from}>${f.to}`);
  for (const e of cal.events as { venue?: string; date: string }[]) if (e.venue) assert.ok(hubs.has(e.venue), `${e.date}: ${e.venue}`);
  for (const p of [...market.producers, ...reserves.reserves]) assert.match(p.iso, /^\d{3}$/);
});

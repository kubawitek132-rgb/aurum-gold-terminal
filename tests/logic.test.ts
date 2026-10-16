import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, mergeCalendar, regionIndex } from '@/lib/services/data';
import { classifyGeo } from '@/lib/goldImpact';
import type { CalendarEvent } from '@/lib/types';

test('indeks regionu: ostatnie 3 dni względem wcześniejszych', () => {
  assert.equal(regionIndex([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2]), 2);
  assert.equal(regionIndex([1, 2, 3]), null); // za krótka seria
  assert.equal(levelOf(1.6), 'HIGH');
  assert.equal(levelOf(1.2), 'ELEVATED');
  assert.equal(levelOf(1.0), 'NORMAL');
  assert.equal(levelOf(0.7), 'LOW');
  assert.equal(levelOf(null), 'UNKNOWN');
});

test('klasyfikacja nagłówków łapie liczbę mnogą i deeskalację', () => {
  assert.equal(classifyGeo('Trump threatens new tariffs on Mexico').category, 'trade');
  assert.equal(classifyGeo('Missiles hit port city overnight').category, 'conflict');
  assert.equal(classifyGeo('China holds military drills around Taiwan').category, 'conflict');
  assert.equal(classifyGeo('Ceasefire negotiations resume in Cairo').category, 'diplomacy');
  assert.equal(classifyGeo('US widens sanctions on oil tankers').category, 'sanctions');
});

test('kalendarz: publikacje USD pomijane (są w GOLD DESK), decyzje banków zostają', () => {
  const ev = (currency: string, title: string): CalendarEvent => ({
    id: title, title, currency, country: '', time: Date.now() + 3600_000, impact: 'High', forecast: '', previous: '', actual: '',
    lat: 0, lon: 0, goldNote: '', goldImpact: 'NEUTRAL', sourceUrl: '',
  });
  const out = mergeCalendar([ev('USD', 'CPI m/m'), ev('GBP', 'GDP m/m')]);
  assert.ok(!out.some((e) => e.title === 'CPI m/m'));
  assert.ok(out.some((e) => e.title === 'GDP m/m'));
  assert.deepEqual(out.map((e) => e.time), [...out.map((e) => e.time)].sort((a, b) => a - b));
});

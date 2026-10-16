import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comexEvents, goldCalendar, usHolidays } from '@/lib/goldCalendar';

test('daty COMEX zgodne z kalendarzem CME (grudzień 2025)', () => {
  const ev = comexEvents(new Date('2025-10-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z'));
  const d = (id: string) => ev.find((e) => e.id === id)?.date;
  assert.equal(d('og-Z25'), '2025-11-24'); // opcje OG
  assert.equal(d('fnd-Z25'), '2025-11-28'); // First Notice Day
  assert.equal(d('ltd-Z25'), '2025-12-29'); // ostatni dzień handlu
});

test('święta USA: Wielki Piątek i Thanksgiving 2026', () => {
  const h = usHolidays(2026);
  assert.ok(h.has('2026-04-03'));
  assert.ok(h.has('2026-11-26'));
});

test('kalendarz złota: tylko najbliższy raport COT i rosnące daty', () => {
  const ev = goldCalendar(60, new Date('2026-10-16T12:00:00Z'));
  assert.equal(ev.filter((e) => e.id.startsWith('cot-')).length, 1);
  const dates = ev.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
});

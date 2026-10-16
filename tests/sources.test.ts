import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseGprWorkbook, gprLevel } from '@/lib/providers/gpr';
import { parseImf, OZ_PER_TONNE } from '@/lib/providers/imf';
import { buildCbGold, changeDays, gprSpikes, reactionStat, summarizeGpr } from '@/lib/services/extra';
import { computeFedExpect, macroHistory, recessionProb, effectAt } from '@/lib/services/macro';
import { lastLevelChange } from '@/lib/providers/fred';
import type { SeriesPoint } from '@/lib/types';

const days = (n: number, f: (i: number) => number, start = '2025-01-01'): SeriesPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), value: f(i) }));

test('GPR: parser pliku .xls (kolumny DAY, GPRD, event)', () => {
  const rows = [['DAY', 'N10D', 'GPRD', 'GPRD_ACT', 'event'], ...Array.from({ length: 400 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
    const day = Number(d.toISOString().slice(0, 10).replace(/-/g, ''));
    return [day, 100, i > 393 ? 300 : 100, 50, i === 398 ? 'Atak rakietowy' : null];
  })];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
  const parsed = parseGprWorkbook(XLSX as never, buf);
  assert.equal(parsed.length, 400);
  assert.equal(parsed[0].date, '2025-01-01');
  const s = summarizeGpr(parsed)!;
  assert.equal(s.level, 'HIGH');
  assert.equal(s.events[0].text, 'Atak rakietowy');
  assert.equal(gprLevel(1.0), 'NORMAL');
});

test('IMF: CSV i SDMX-ML → tony, odrzucenie błędu skali', () => {
  const oz = (t: number) => String(t * OZ_PER_TONNE);
  const csv = ['DATAFLOW,COUNTRY,INDICATOR,FREQUENCY,TIME_PERIOD,OBS_VALUE',
    `IRFCL,POL,G,M,2026-M06,${oz(600)}`, `IRFCL,POL,G,M,2026-M07,${oz(615)}`, `IRFCL,POL,G,M,2026-M08,${oz(632)}`,
    `IRFCL,BRA,G,M,2026-M07,${oz(145)}`, `IRFCL,BRA,G,M,2026-M08,${oz(145 * 1000)}`].join('\n');
  const a = parseImf(csv);
  const pol = a.find((s) => s.iso3 === 'POL')!;
  assert.deepEqual(pol.points.map((p) => p.tonnes), [600, 615, 632]);
  assert.equal(a.find((s) => s.iso3 === 'BRA')!.points.length, 1); // ×1000 odrzucone
  const xml = `<message:StructureSpecificData><DataSet><Series COUNTRY="CHN" FREQ="M"><Obs TIME_PERIOD="2026-07" OBS_VALUE="${oz(2388)}"/><Obs TIME_PERIOD="2026-08" OBS_VALUE="${oz(2411)}"/></Series></DataSet></message:StructureSpecificData>`;
  const b = parseImf(xml);
  assert.equal(b[0].points.at(-1)!.tonnes, 2411);
  const cb = buildCbGold([...a, ...b])!;
  assert.equal(cb.latestPeriod, '2026-08');
  assert.equal(cb.rows.find((r) => r.iso3 === 'POL')!.change1m, 17);
  assert.ok(cb.netLastMonth > 0);
});

test('reakcje: ruch w dniu zdarzenia i po 5 sesjach', () => {
  const xau = days(60, (i) => 100 + i);
  const st = reactionStat(xau, ['2025-01-10', '2025-01-20', '2025-01-30'], 'x', 'X', '')!;
  assert.equal(st.n, 3);
  assert.equal(st.up0, 100);
  assert.ok(st.avg5 > st.avg0);
  const fed = changeDays([{ date: '2024-09-18', value: 5.5 }, { date: '2024-09-19', value: 5.0 }], 'prevBizDay');
  assert.deepEqual(fed.down, ['2024-09-18']);
  const spikes = gprSpikes(days(500, (i) => (i === 450 ? 500 : 100)));
  assert.deepEqual(spikes.length, 1);
});

test('makro: historia bilansu, model recesji NY Fed, oczekiwania wobec Fed, zmiana stopy', () => {
  assert.ok(Math.abs(recessionProb(0) - 29.7) < 0.2); // Φ(−0.5333)
  assert.ok(recessionProb(-1) > recessionProb(1));
  const flat = days(500, () => 2);
  const m = { DFII10: days(500, (i) => 2 - i * 0.01), DTWEXBGS: flat, T10YIE: flat, DFF: flat, EXP1: flat, BAMLH0A0HYM2: flat, VIXCLS: flat, WALCL: flat, DCOILBRENTEU: flat } as never;
  const h = macroHistory(m, 10);
  assert.equal(h.length, 10);
  assert.ok(h.every((p) => p.tailwinds === 1 && p.headwinds === 0)); // spadające realne stopy = wiatr w plecy
  assert.equal(effectAt({ kind: 'bp', th: 10, dir: -1, lag: 1 }, [{ date: 'a', value: 2 }, { date: 'b', value: 2.2 }], 1)!.effect, 'HEADWIND');
  const fe = computeFedExpect(days(30, () => 4), days(30, () => 3.5), days(30, () => 3.4))!;
  assert.equal(fe.spread1, -50);
  assert.match(fe.label, /obniżki/);
  assert.deepEqual(lastLevelChange([{ date: '2026-09-01', value: 3.75 }, { date: '2026-09-17', value: 4 }, { date: '2026-09-18', value: 4 }]), { date: '2026-09-17', bps: 25, value: 4 });
});

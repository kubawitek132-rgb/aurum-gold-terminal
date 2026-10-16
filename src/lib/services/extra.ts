/**
 * Moduły uzupełniające tło: indeks GPR, zakupy złota przez banki centralne (IMF) i statystyki reakcji złota.
 */
import { cached } from '../cache';
import type { CbGoldData, CbGoldRow, GprData, ReactionStat, ReactionsData, SeriesPoint, SourceResult } from '../types';
import { fetchGpr, gprLevel, type GprRow } from '../providers/gpr';
import { fetchImfGold, IMF_COUNTRIES, type ImfSeries } from '../providers/imf';
import { tdConfigured, tdDaily } from '../providers/twelvedata';
import { fredConfigured, fredLong } from '../providers/fred';
import { comexEvents } from '../goldCalendar';

const H = 3_600_000;
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/* ───────────── GPR ───────────── */
export function gprRows(): Promise<SourceResult<GprRow[]>> {
  return cached('gpr:rows', async () => ({ data: await fetchGpr(), source: 'GPR — Caldara & Iacoviello (dzienny)' }), {
    ttlMs: 12 * H,
    retryMs: 2 * H,
    firstWaitMs: 8000,
    fallback: () => ({ data: [], source: 'GPR chwilowo niedostępny' }),
  });
}

export function summarizeGpr(rows: GprRow[]): GprData | null {
  if (rows.length < 60) return null;
  const vals = rows.map((r) => r.value);
  const last = rows.at(-1)!;
  const r7 = avg(vals.slice(-7));
  const base = avg(vals.slice(-365));
  const ratio = base > 0 ? +(r7 / base).toFixed(2) : 1;
  const tail = rows.slice(-90);
  const cutoff = tail[0].date;
  return {
    latest: +last.value.toFixed(1),
    latestDate: last.date,
    avg30: +avg(vals.slice(-30)).toFixed(1),
    ratio,
    level: gprLevel(ratio),
    series: tail.map((r) => +r.value.toFixed(1)),
    dates: tail.map((r) => r.date),
    events: rows
      .filter((r) => r.event && r.date >= cutoff)
      .slice(-6)
      .reverse()
      .map((r) => ({ date: r.date, text: r.event as string })),
  };
}

export async function getGpr(): Promise<SourceResult<GprData | null>> {
  const r = await gprRows();
  return { ...r, data: summarizeGpr(r.data) };
}

/* ───────────── ZAKUPY ZŁOTA PRZEZ BANKI CENTRALNE (IMF) ───────────── */
export function buildCbGold(series: ImfSeries[]): CbGoldData | null {
  if (!series.length) return null;
  // najczęstszy ostatni okres = miesiąc, za który większość krajów już raportowała
  const lastPeriods = series.map((s) => s.points.at(-1)!.period);
  const freq = new Map<string, number>();
  for (const p of lastPeriods) freq.set(p, (freq.get(p) ?? 0) + 1);
  const latestPeriod = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
  const rows: CbGoldRow[] = series.map((s) => {
    const pts = s.points.filter((p) => p.period <= latestPeriod);
    const n = pts.length;
    const cur = pts[n - 1];
    const prev = n > 1 ? pts[n - 2] : null;
    const y = pts.find((p) => p.period === shiftMonth(cur.period, -12));
    return {
      iso3: s.iso3,
      name: IMF_COUNTRIES[s.iso3] ?? s.iso3,
      tonnes: cur.tonnes,
      change1m: prev && prev.period === shiftMonth(cur.period, -1) ? +(cur.tonnes - prev.tonnes).toFixed(1) : null,
      change12m: y ? +(cur.tonnes - y.tonnes).toFixed(1) : null,
      period: cur.period,
      history: pts.slice(-13).map((p) => p.tonnes),
    };
  });
  const fresh = rows.filter((r) => r.period === latestPeriod && r.change1m !== null);
  return {
    rows: rows.sort((a, b) => (b.change12m ?? -1e9) - (a.change12m ?? -1e9)),
    latestPeriod,
    netLastMonth: +fresh.reduce((s, r) => s + (r.change1m as number), 0).toFixed(1),
    buyers: fresh.filter((r) => (r.change1m as number) >= 0.5).length,
    sellers: fresh.filter((r) => (r.change1m as number) <= -0.5).length,
  };
}

export function shiftMonth(period: string, k: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return d.toISOString().slice(0, 7);
}

export function getCbGold(): Promise<SourceResult<CbGoldData | null>> {
  return cached('imf:gold', async () => ({ data: buildCbGold(await fetchImfGold()), source: 'IMF IRFCL (rezerwy złota, miesięcznie)' }), {
    ttlMs: 24 * H,
    retryMs: 3 * H,
    firstWaitMs: 8000,
    fallback: () => ({ data: null, source: 'IMF chwilowo niedostępne' }),
  });
}

/* ───────────── REAKCJE ZŁOTA NA TYPY ZDARZEŃ ───────────── */
const DAY = 86_400_000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Statystyka ruchu XAU w dniu zdarzenia (zamknięcie/zamknięcie) i do 5 sesji po. */
export function reactionStat(xau: SeriesPoint[], dates: string[], id: string, label: string, note: string): ReactionStat | null {
  const idx = (d: string) => {
    let lo = 0;
    let hi = xau.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (xau[mid].date >= d) {
        ans = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    return ans; // pierwsza sesja w dniu zdarzenia lub po nim
  };
  const r0: number[] = [];
  const r5: number[] = [];
  let last: string | null = null;
  const used = new Set<number>();
  for (const d of [...new Set(dates)].sort()) {
    if (d < xau[0]?.date || d > (xau.at(-1)?.date ?? '')) continue;
    const i = idx(d);
    if (i < 1 || used.has(i) || Date.parse(xau[i].date) - Date.parse(d) > 4 * DAY) continue;
    used.add(i);
    r0.push((xau[i].value / xau[i - 1].value - 1) * 100);
    if (i + 5 < xau.length) r5.push((xau[i + 5].value / xau[i - 1].value - 1) * 100);
    last = d;
  }
  if (r0.length < 3) return null;
  const sorted = [...r0].sort((a, b) => a - b);
  const med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    id,
    label,
    n: r0.length,
    avg0: +avg(r0).toFixed(2),
    median0: +med.toFixed(2),
    up0: Math.round((r0.filter((x) => x > 0).length / r0.length) * 100),
    avg5: +avg(r5).toFixed(2),
    last,
    note,
  };
}

/** Dni zmian poziomu stopy (data obowiązywania) → dzień decyzji: poprzedni dzień roboczy / poprzedni czwartek (ECB). */
export function changeDays(s: SeriesPoint[], mode: 'prevBizDay' | 'prevThursday'): { up: string[]; down: string[] } {
  const up: string[] = [];
  const down: string[] = [];
  for (let i = 1; i < s.length; i++) {
    const d = Math.round((s[i].value - s[i - 1].value) * 100);
    if (!d) continue;
    let t = Date.parse(s[i].date + 'T00:00:00Z') - DAY;
    if (mode === 'prevBizDay') while ([0, 6].includes(new Date(t).getUTCDay())) t -= DAY;
    else while (new Date(t).getUTCDay() !== 4) t -= DAY;
    (d > 0 ? up : down).push(ymd(t));
  }
  return { up, down };
}

/** Dni szczytów GPR: wartość powyżej 95. percentyla z poprzednich 365 dni i ≥1,5× średnia 30 dni; co najmniej 10 dni odstępu. */
export function gprSpikes(rows: SeriesPoint[]): string[] {
  const out: string[] = [];
  let lastT = 0;
  for (let i = 365; i < rows.length; i++) {
    const win = rows.slice(i - 365, i).map((r) => r.value).sort((a, b) => a - b);
    const p95 = win[Math.floor(win.length * 0.95)];
    const m30 = avg(rows.slice(i - 30, i).map((r) => r.value));
    const t = Date.parse(rows[i].date);
    if (rows[i].value > p95 && rows[i].value >= 1.5 * m30 && t - lastT > 10 * DAY) {
      out.push(rows[i].date);
      lastT = t;
    }
  }
  return out;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export function getReactions(): Promise<SourceResult<ReactionsData | null>> {
  if (!tdConfigured()) {
    return Promise.resolve({ data: null, source: 'wymaga TWELVEDATA_API_KEY (1 zapytanie na dobę)', updatedAt: null, stale: false });
  }
  return cached<ReactionsData | null>(
    'reactions',
    async () => {
      const xau = await tdDaily('XAU/USD', 5000);
      if (xau.length < 300) throw new Error('za krótka historia XAU/USD');
      const from = xau[0].date;
      const stats: (ReactionStat | null)[] = [];
      if (fredConfigured()) {
        const [old, cur, ecb] = await Promise.all([safe(fredLong('DFEDTAR')), safe(fredLong('DFEDTARU'))]).then(async (r) => [...r, await safe(fredLong('ECBDFR'))]);
        const fedSeries = [...(old?.data ?? []), ...(cur?.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
        if (fedSeries.length) {
          const fed = changeDays(fedSeries, 'prevBizDay');
          stats.push(reactionStat(xau, fed.up, 'fed-hike', 'Fed podnosi stopy', 'Dzień decyzji (data z FRED − 1 dzień roboczy).'));
          stats.push(reactionStat(xau, fed.down, 'fed-cut', 'Fed obniża stopy', 'W tym cięcia awaryjne (2008, 2020).'));
        }
        if (ecb?.data.length) {
          const e = changeDays(ecb.data, 'prevThursday');
          stats.push(reactionStat(xau, e.up, 'ecb-hike', 'ECB podnosi stopy', 'Data decyzji przybliżona (czwartek przed wejściem w życie).'));
          stats.push(reactionStat(xau, e.down, 'ecb-cut', 'ECB obniża stopy', 'Data decyzji przybliżona (czwartek przed wejściem w życie).'));
        }
      }
      const cme = comexEvents(new Date(from + 'T00:00:00Z'), new Date());
      stats.push(reactionStat(xau, cme.filter((e) => e.id.startsWith('og-')).map((e) => e.date), 'og', 'Wygasanie opcji OG', 'Reguły CME liczone wstecz.'));
      stats.push(reactionStat(xau, cme.filter((e) => e.id.startsWith('fnd-')).map((e) => e.date), 'fnd', 'First Notice Day GC', 'Tylko aktywne miesiące kontraktowe.'));
      const gpr = await safe(gprRows());
      if (gpr?.data.length) {
        stats.push(reactionStat(xau, gprSpikes(gpr.data), 'gpr', 'Szczyt ryzyka geopolitycznego (GPR)', 'Dzień, w którym GPR przekracza 95. percentyl roku i 1,5× średnią 30 dni.'));
      }
      const ok = stats.filter((s): s is ReactionStat => !!s);
      if (!ok.length) throw new Error('brak zdarzeń do policzenia');
      return { data: { stats: ok, from, to: xau.at(-1)!.date, days: xau.length }, source: 'Twelve Data (XAU/USD dziennie) + FRED + reguły CME + GPR' };
    },
    { ttlMs: 24 * H, retryMs: 3 * H, firstWaitMs: 10_000, fallback: () => ({ data: null, source: 'statystyki chwilowo niedostępne' }) },
  );
}

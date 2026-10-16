/**
 * Provider: FRED (St. Louis Fed) — czynniki makro dla złota (horyzont tygodni/miesięcy).
 * Klucz: https://fred.stlouisfed.org/docs/api/api_key.html (darmowy).
 */
import { cached } from '../cache';
import { fetchJson } from '../http';
import type { SeriesPoint } from '../types';

export const FRED_SERIES = {
  DFII10: { label: 'Realna rentowność 10Y (TIPS)' },
  T10YIE: { label: 'Breakeven inflacji 10Y' },
  DTWEXBGS: { label: 'USD Broad Index' },
  DFF: { label: 'Fed funds (efektywna)' },
  DGS1: { label: 'Rentowność 1Y' },
  DGS2: { label: 'Rentowność 2Y' },
  T10Y2Y: { label: 'Spread 10Y–2Y' },
  T10Y3M: { label: 'Spread 10Y–3M' },
  BAMLH0A0HYM2: { label: 'Spread high yield' },
  VIXCLS: { label: 'VIX' },
  WALCL: { label: 'Bilans Fed' },
  DCOILBRENTEU: { label: 'Brent' },
  DCOILWTICO: { label: 'WTI' },
  // stopy banków — do automatycznej aktualizacji Fed i ECB (brak danych nigdy nie nadpisuje JSON)
  DFEDTARU: { label: 'Fed — górna granica celu' },
  DFEDTARL: { label: 'Fed — dolna granica celu' },
  ECBDFR: { label: 'ECB — stopa depozytowa' },
} as const;
export type FredId = keyof typeof FRED_SERIES;

const TTL = Number(process.env.FRED_TTL_SEC ?? 6 * 3600) * 1000;

export function fredConfigured() {
  return !!process.env.FRED_API_KEY;
}

type FredObs = { observations?: { date: string; value: string }[]; error_message?: string };

function parse(id: string, raw: FredObs): SeriesPoint[] {
  if (!raw.observations) throw new Error(`FRED ${id}: ${raw.error_message ?? 'brak danych'}`);
  const pts = raw.observations
    .filter((o) => o.value !== '.' && o.value !== '')
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 10) throw new Error(`FRED ${id}: za mało obserwacji`);
  return pts;
}

function apiKey() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('Brak FRED_API_KEY');
  return key;
}

/** 600 ostatnich obserwacji — wystarcza na rok historii tła przy najdłuższym oknie (DFF, 91 dni). */
async function fetchSeries(id: string): Promise<SeriesPoint[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey()}&file_type=json&sort_order=desc&limit=600`;
  return parse(id, await fetchJson<FredObs>(url));
}

export function fredSeries(id: FredId) {
  return cached<SeriesPoint[]>(`fred:${id}`, async () => ({ data: await fetchSeries(id), source: 'FRED' }), {
    ttlMs: TTL,
    retryMs: 15 * 60_000,
    // bez klucza lub przy awarii FRED: pusta seria oznaczona jako brak danych (nigdy liczby zastępcze)
    fallback: () => ({ data: [], source: fredConfigured() ? 'FRED chwilowo niedostępny' : 'wymaga FRED_API_KEY' }),
  });
}

export type FredResults = Record<FredId, Awaited<ReturnType<typeof fredSeries>>>;

export async function fredAll(): Promise<FredResults> {
  // równolegle: kilkanaście zapytań mieści się w limicie FRED (120/min), pierwszy start trwa sekundy
  const ids = Object.keys(FRED_SERIES) as FredId[];
  const res = await Promise.all(ids.map((id) => fredSeries(id)));
  return Object.fromEntries(ids.map((id, i) => [id, res[i]])) as FredResults;
}

/** Długa historia (od `start`) — do statystyk reakcji złota; odświeżana raz na dobę. */
export function fredLong(id: string, start = '2006-01-01') {
  return cached<SeriesPoint[]>(
    `fredlong:${id}`,
    async () => {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey()}&file_type=json&observation_start=${start}`;
      return { data: parse(id, await fetchJson<FredObs>(url, 20_000)), source: 'FRED' };
    },
    { ttlMs: 24 * 3600_000, retryMs: 60 * 60_000, firstWaitMs: 15_000 },
  );
}

/** Data i wielkość (pb) ostatniej zmiany poziomu serii stóp, np. DFEDTARU. */
export function lastLevelChange(s: SeriesPoint[]): { date: string; bps: number; value: number } | null {
  for (let i = s.length - 1; i > 0; i--) {
    const d = Math.round((s[i].value - s[i - 1].value) * 100);
    if (d !== 0) return { date: s[i].date, bps: d, value: s[i].value };
  }
  return null;
}

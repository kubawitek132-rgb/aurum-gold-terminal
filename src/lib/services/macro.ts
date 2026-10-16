/**
 * TŁO MAKRO dla złota — horyzont tygodni/miesięcy (uzupełnienie krótkoterminowej analizy w GOLD DESK).
 * Każdy czynnik ma jawną regułę: WIATR W PLECY / W TWARZ / NEUTRALNIE. To opis kontekstu, nie sygnał.
 * Historia bilansu liczona jest wstecz z tych samych serii FRED (te same reguły w każdym tygodniu).
 */
import { fredAll, type FredId, type FredResults } from '../providers/fred';
import type { Effect, FedExpect, MacroData, MacroFactor, MacroHistoryPoint, Sentiment, SeriesPoint, TapeItem } from '../types';

interface FactorDef {
  id: string;
  /** seria FRED albo seria pochodna (np. różnica dwóch serii) */
  src: FredId | 'EXP1';
  label: string;
  lag: number;
  horizon: string;
  kind: 'bp' | 'pct' | 'pts';
  /** próg (bp, % albo punkty) */
  th: number;
  /** +1: wzrost pomaga złotu, -1: wzrost szkodzi */
  dir: 1 | -1;
  fmt: (v: number) => string;
  rule: string;
  hist: number;
}

export const FACTORS: FactorDef[] = [
  {
    id: 'real', src: 'DFII10', label: 'Realna rentowność 10Y', lag: 20, horizon: '4 tyg.', kind: 'bp', th: 10, dir: -1, hist: 130,
    fmt: (v) => `${v.toFixed(2)}%`, rule: 'Spadek o >10 bp = wiatr w plecy (niższy koszt alternatywny trzymania złota); wzrost o >10 bp = w twarz.',
  },
  {
    id: 'usd', src: 'DTWEXBGS', label: 'Dolar (Broad Index)', lag: 20, horizon: '4 tyg.', kind: 'pct', th: 1, dir: -1, hist: 130,
    fmt: (v) => v.toFixed(2), rule: 'Spadek dolara o >1% = wiatr w plecy (złoto tańsze dla reszty świata); wzrost o >1% = w twarz.',
  },
  {
    id: 'bei', src: 'T10YIE', label: 'Oczekiwania inflacyjne 10Y', lag: 20, horizon: '4 tyg.', kind: 'bp', th: 8, dir: 1, hist: 130,
    fmt: (v) => `${v.toFixed(2)}%`, rule: 'Wzrost breakevenów o >8 bp = wiatr w plecy (popyt na ochronę przed inflacją); spadek = w twarz.',
  },
  {
    // DFF to szereg 7-dniowy (z weekendami) — 91 obserwacji = 3 miesiące, 182 = pół roku
    id: 'ff', src: 'DFF', label: 'Stopa Fed (efektywna)', lag: 91, horizon: '3 mies.', kind: 'bp', th: 10, dir: -1, hist: 182,
    fmt: (v) => `${v.toFixed(2)}%`, rule: 'Podwyżki Fed w ostatnich 3 mies. = wiatr w twarz; obniżki = w plecy.',
  },
  {
    id: 'exp', src: 'EXP1', label: 'Oczekiwania wobec Fed (1Y − EFFR)', lag: 20, horizon: '4 tyg.', kind: 'bp', th: 15, dir: -1, hist: 130,
    fmt: (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)} pb`,
    rule: 'Rentowność 1Y względem stopy Fed: spadek o >15 bp = rynek dokłada obniżek (wiatr w plecy); wzrost o >15 bp = wycenia jastrzębi Fed (w twarz).',
  },
  {
    id: 'hy', src: 'BAMLH0A0HYM2', label: 'Stres kredytowy (spread HY)', lag: 20, horizon: '4 tyg.', kind: 'bp', th: 40, dir: 1, hist: 130,
    fmt: (v) => `${v.toFixed(2)}%`, rule: 'Rozszerzenie spreadu o >40 bp (stres) = popyt na bezpieczne aktywa; silne zawężenie (apetyt na ryzyko) = w twarz.',
  },
  {
    id: 'vix', src: 'VIXCLS', label: 'Zmienność akcji (VIX)', lag: 20, horizon: '4 tyg.', kind: 'pts', th: 5, dir: 1, hist: 130,
    fmt: (v) => v.toFixed(1),
    rule: 'Wzrost VIX o >5 pkt (ucieczka od ryzyka) = zwykle wsparcie dla złota; spadek o >5 pkt = w twarz. W ostrej panice złoto bywa jednak sprzedawane na pokrycie strat.',
  },
  {
    id: 'bs', src: 'WALCL', label: 'Bilans Fed (płynność)', lag: 13, horizon: '13 tyg.', kind: 'pct', th: 1, dir: 1, hist: 52,
    fmt: (v) => `$${(v / 1e6).toFixed(2)} bln`, rule: 'Wzrost bilansu o >1% (dodruk/płynność) = wiatr w plecy; zmniejszanie (QT) o >1% = w twarz.',
  },
  {
    id: 'oil', src: 'DCOILBRENTEU', label: 'Ropa Brent', lag: 20, horizon: '4 tyg.', kind: 'pct', th: 10, dir: 1, hist: 130,
    fmt: (v) => `$${v.toFixed(2)}`, rule: 'Wzrost ropy o >10% = presja inflacyjna i ryzyko geopolityczne → wsparcie; spadek o >10% = w twarz.',
  },
];

/** Różnica dwóch serii po wspólnych datach (a − b). */
export function spreadSeries(a: SeriesPoint[], b: SeriesPoint[]): SeriesPoint[] {
  const bm = new Map(b.map((p) => [p.date, p.value]));
  return a.filter((p) => bm.has(p.date)).map((p) => ({ date: p.date, value: +(p.value - (bm.get(p.date) as number)).toFixed(4) }));
}

export type SeriesMap = Record<FactorDef['src'], SeriesPoint[]>;

export function seriesMap(fred: FredResults): SeriesMap {
  const m = {} as SeriesMap;
  for (const k of Object.keys(fred) as FredId[]) m[k] = fred[k].data;
  m.EXP1 = spreadSeries(fred.DGS1.data, fred.DFF.data);
  return m;
}

/** Efekt czynnika liczony na obserwacji o indeksie idx (zmiana względem idx − lag). */
export function effectAt(f: Pick<FactorDef, 'kind' | 'th' | 'dir' | 'lag'>, s: SeriesPoint[], idx: number): { effect: Effect; change: number } | null {
  if (idx < f.lag || idx >= s.length) return null;
  const last = s[idx].value;
  const prev = s[idx - f.lag].value;
  const change = f.kind === 'pct' ? ((last - prev) / prev) * 100 : f.kind === 'bp' ? (last - prev) * 100 : last - prev;
  const effect: Effect = Math.abs(change) > f.th ? (Math.sign(change) === f.dir ? 'TAILWIND' : 'HEADWIND') : 'NEUTRAL';
  return { effect, change };
}

function changeLabel(kind: FactorDef['kind'], ch: number) {
  if (kind === 'bp') {
    const r = Math.round(ch);
    return r === 0 ? '0 bp' : `${r > 0 ? '+' : ''}${r} bp`;
  }
  if (kind === 'pts') {
    const r = +ch.toFixed(1);
    return r === 0 ? '0 pkt' : `${r > 0 ? '+' : ''}${r.toFixed(1)} pkt`;
  }
  const r = +ch.toFixed(2);
  return r === 0 ? '0.00%' : `${r > 0 ? '+' : ''}${r.toFixed(2)}%`;
}

/** Indeks ostatniej obserwacji z datą ≤ date (wyszukiwanie binarne). */
export function idxAtOrBefore(s: SeriesPoint[], date: string): number {
  let lo = 0;
  let hi = s.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].date <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Bilans czynników w każdym z ostatnich `weeks` tygodni (te same reguły co dziś). */
export function macroHistory(m: SeriesMap, weeks = 52, end?: string): MacroHistoryPoint[] {
  const latest = end ?? FACTORS.map((f) => m[f.src].at(-1)?.date ?? '').sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const endT = Date.parse(latest + 'T00:00:00Z');
  const out: MacroHistoryPoint[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const date = new Date(endT - k * 7 * 86_400_000).toISOString().slice(0, 10);
    let tw = 0;
    let hw = 0;
    for (const f of FACTORS) {
      const e = effectAt(f, m[f.src], idxAtOrBefore(m[f.src], date));
      if (e?.effect === 'TAILWIND') tw++;
      else if (e?.effect === 'HEADWIND') hw++;
    }
    out.push({ date, tailwinds: tw, headwinds: hw, net: tw - hw });
  }
  return out;
}

/** Rozkład normalny — dystrybuanta (Abramowitz–Stegun 7.1.26). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Model NY Fed: P(recesja za 12 mies.) = Φ(−0.5333 − 0.6330 × spread 10Y–3M), spread w pp (średnia miesięczna). */
export function recessionProb(spread: number): number {
  return normCdf(-0.5333 - 0.633 * spread) * 100;
}

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

export function computeFedExpect(dff: SeriesPoint[], dgs1: SeriesPoint[], dgs2: SeriesPoint[]): FedExpect | null {
  const e1 = spreadSeries(dgs1, dff);
  const e2 = spreadSeries(dgs2, dff);
  if (!e1.length || !e2.length) return null;
  const l1 = e1.at(-1)!;
  const l2 = e2.at(-1)!;
  const effr = dff.find((p) => p.date === l1.date)?.value ?? dff.at(-1)!.value;
  const s1 = Math.round(l1.value * 100);
  const s2 = Math.round(l2.value * 100);
  const ch = e1.length > 20 ? Math.round((l1.value - e1[e1.length - 21].value) * 100) : null;
  const label =
    s1 <= -15
      ? `rynek wycenia obniżki: średnia stopa w 12 mies. ~${-s1} pb niżej niż dziś`
      : s1 >= 15
        ? `rynek wycenia podwyżki: średnia stopa w 12 mies. ~${s1} pb wyżej niż dziś`
        : 'rynek nie wycenia wyraźnych zmian stóp w 12 mies.';
  return {
    effr,
    y1: dgs1.find((p) => p.date === l1.date)?.value ?? dgs1.at(-1)!.value,
    y2: dgs2.at(-1)!.value,
    spread1: s1,
    spread2: s2,
    change4w: ch,
    label,
    asOf: l1.date,
  };
}

function sentiment(fred: FredResults): Sentiment {
  const vix = fred.VIXCLS.missing ? null : fred.VIXCLS.data;
  const t3m = fred.T10Y3M.missing ? null : fred.T10Y3M.data;
  const exp = fred.DFF.missing || fred.DGS1.missing || fred.DGS2.missing ? null : computeFedExpect(fred.DFF.data, fred.DGS1.data, fred.DGS2.data);
  let recession: Sentiment['recession'] = null;
  if (t3m && t3m.length > 30) {
    const spread = avg(t3m.slice(-21).map((p) => p.value));
    const prev = t3m.length > 84 ? avg(t3m.slice(-84, -63).map((p) => p.value)) : null;
    recession = {
      prob: +recessionProb(spread).toFixed(1),
      spread: +spread.toFixed(2),
      prob3mAgo: prev === null ? null : +recessionProb(prev).toFixed(1),
      asOf: t3m.at(-1)!.date,
    };
  }
  return {
    vix:
      vix && vix.length > 21
        ? { value: vix.at(-1)!.value, change4w: +(vix.at(-1)!.value - vix[vix.length - 21].value).toFixed(1), asOf: vix.at(-1)!.date }
        : null,
    recession,
    fedExpect: exp,
  };
}

export type MacroFull = MacroData & { history: MacroHistoryPoint[]; sentiment: Sentiment };

export async function getMacro(): Promise<MacroFull> {
  const fred = await fredAll();
  const m = seriesMap(fred);
  const isMock = (f: FactorDef) => (f.src === 'EXP1' ? fred.DGS1.missing || fred.DFF.missing : fred[f.src].missing);
  const isStale = (f: FactorDef) => (f.src === 'EXP1' ? fred.DGS1.stale || fred.DFF.stale : fred[f.src].stale);
  const factors: MacroFactor[] = FACTORS.map((f) => {
    const s = m[f.src];
    const e = effectAt(f, s, s.length - 1);
    const last = s.at(-1);
    return {
      id: f.id,
      label: f.label,
      value: last?.value ?? null,
      valueLabel: last ? f.fmt(last.value) : '—',
      changeLabel: e ? changeLabel(f.kind, e.change) : '—',
      horizon: f.horizon,
      effect: e?.effect ?? 'NEUTRAL',
      rule: f.rule,
      history: s.slice(-f.hist).map((p) => p.value),
      asOf: last?.date ?? null,
      source: f.src === 'EXP1' ? 'FRED (DGS1 − DFF)' : fred[f.src].source,
      missing: !!isMock(f),
      stale: !!isStale(f),
    };
  });
  const real = factors.filter((f) => !f.missing);
  const tailwinds = real.filter((f) => f.effect === 'TAILWIND').length;
  const headwinds = real.filter((f) => f.effect === 'HEADWIND').length;
  const neutral = real.length - tailwinds - headwinds;
  const summary = !real.length
    ? 'Brak danych FRED — ustaw FRED_API_KEY.'
    : tailwinds > headwinds
      ? `Tło makro przeważnie sprzyja złotu (${tailwinds} za, ${headwinds} przeciw).`
      : headwinds > tailwinds
        ? `Tło makro przeważnie nie sprzyja złotu (${headwinds} przeciw, ${tailwinds} za).`
        : `Tło makro zrównoważone (${tailwinds} za, ${headwinds} przeciw).`;
  return {
    factors,
    tailwinds,
    headwinds,
    neutral,
    summary,
    computedAt: Date.now(),
    stale: factors.some((f) => f.stale),
    missing: real.length === 0,
    pending: Object.values(fred).some((r) => r.pending),
    history: real.length ? macroHistory(m) : [],
    sentiment: sentiment(fred),
  };
}

/** Zmiany efektów czynników od poprzedniej obserwacji (do skrótu dnia). */
export async function macroChanges(): Promise<{ id: string; label: string; from: Effect; to: Effect; asOf: string }[]> {
  const fred = await fredAll();
  const m = seriesMap(fred);
  const out: { id: string; label: string; from: Effect; to: Effect; asOf: string }[] = [];
  for (const f of FACTORS) {
    const missing = f.src === 'EXP1' ? fred.DGS1.missing : fred[f.src].missing;
    if (missing) continue;
    const s = m[f.src];
    const now = effectAt(f, s, s.length - 1);
    const prev = effectAt(f, s, s.length - 2);
    if (now && prev && now.effect !== prev.effect) out.push({ id: f.id, label: f.label, from: prev.effect, to: now.effect, asOf: s.at(-1)!.date });
  }
  return out;
}

const TAPE: { fred: FredId; symbol: string; unit: TapeItem['unit']; decimals: number; lag: number; note?: string }[] = [
  { fred: 'DFII10', symbol: 'REAL 10Y', unit: '%', decimals: 2, lag: 5, note: 'rentowność 10Y TIPS' },
  { fred: 'T10YIE', symbol: 'BEI 10Y', unit: '%', decimals: 2, lag: 5, note: 'breakeven inflacji 10Y' },
  { fred: 'DTWEXBGS', symbol: 'USD BROAD', unit: 'idx', decimals: 2, lag: 5, note: 'indeks dolara (FRED)' },
  { fred: 'DFF', symbol: 'FED FUNDS', unit: '%', decimals: 2, lag: 7 }, // szereg z weekendami
  { fred: 'DGS2', symbol: 'UST 2Y', unit: '%', decimals: 2, lag: 5, note: 'rentowność 2Y — oczekiwania wobec Fed' },
  { fred: 'T10Y2Y', symbol: '10Y–2Y', unit: '%', decimals: 2, lag: 5, note: 'nachylenie krzywej' },
  { fred: 'BAMLH0A0HYM2', symbol: 'HY SPREAD', unit: '%', decimals: 2, lag: 5, note: 'stres kredytowy' },
  { fred: 'VIXCLS', symbol: 'VIX', unit: 'idx', decimals: 1, lag: 5, note: 'zmienność S&P 500' },
  { fred: 'WALCL', symbol: 'FED BS', unit: 'bn', decimals: 0, lag: 1, note: 'bilans Fed, mld USD' },
  { fred: 'DCOILBRENTEU', symbol: 'BRENT', unit: 'usd', decimals: 2, lag: 5 },
  { fred: 'DCOILWTICO', symbol: 'WTI', unit: 'usd', decimals: 2, lag: 5 },
];

/** Pasek makro na dole ekranu — zmiana tygodniowa (dane dzienne/tygodniowe FRED). */
export async function getTape(): Promise<TapeItem[]> {
  const fred = await fredAll();
  return TAPE.map((t) => {
    const r = fred[t.fred];
    const s = r.data;
    const ok = s.length > t.lag;
    const last = ok ? s[s.length - 1] : null;
    const prev = ok ? s[s.length - 1 - t.lag] : null;
    const scale = t.unit === 'bn' ? 1 / 1000 : 1; // WALCL w mln USD → mld
    const isRate = t.unit === '%';
    return {
      symbol: t.symbol,
      label: t.symbol,
      value: last ? last.value * scale : null,
      change: last && prev ? (isRate ? (last.value - prev.value) * 100 : ((last.value - prev.value) / prev.value) * 100) : null,
      unit: t.unit,
      decimals: t.decimals,
      asOf: last?.date ?? null,
      missing: r.missing,
      stale: r.stale,
      note: t.note,
    };
  });
}

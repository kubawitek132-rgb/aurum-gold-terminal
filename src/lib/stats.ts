import type { SeriesPoint } from './types';

export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  let sa = 0,
    sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / n,
    mb = sb / n;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma,
      y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

/** Łączy dwie serie dzienne po dacie (inner join), rosnąco. */
export function alignByDate(a: SeriesPoint[], b: SeriesPoint[]): { dates: string[]; a: number[]; b: number[] } {
  const mb = new Map(b.map((p) => [p.date, p.value]));
  const dates: string[] = [];
  const va: number[] = [];
  const vb: number[] = [];
  for (const p of [...a].sort((x, y) => x.date.localeCompare(y.date))) {
    const v = mb.get(p.date);
    if (v === undefined) continue;
    dates.push(p.date);
    va.push(p.value);
    vb.push(v);
  }
  return { dates, a: va, b: vb };
}

export function pctChanges(v: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) out.push(v[i - 1] ? (v[i] - v[i - 1]) / v[i - 1] : 0);
  return out;
}

export function diffs(v: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) out.push(v[i] - v[i - 1]);
  return out;
}

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Zmiana wartości serii o `lag` obserwacji wstecz. */
export function changeOver(series: SeriesPoint[], lag: number): { last: number; prev: number } | null {
  if (series.length <= lag) return null;
  const s = [...series].sort((x, y) => x.date.localeCompare(y.date));
  return { last: s[s.length - 1].value, prev: s[s.length - 1 - lag].value };
}

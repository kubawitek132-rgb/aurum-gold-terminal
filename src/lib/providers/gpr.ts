/**
 * Provider: indeks ryzyka geopolitycznego GPR (Caldara & Iacoviello, Fed Board) — dzienny, aktualizowany w poniedziałki.
 * Źródło: https://www.matteoiacoviello.com/gpr.htm (plik Excel .xls). Bez klucza.
 * Indeks liczy udział artykułów o napięciach geopolitycznych w 10 dużych gazetach — akademicki punkt odniesienia
 * obok GDELT (który mierzy natężenie relacji w tysiącach źródeł).
 */
import { fetchBuffer, fetchText } from '../http';
import type { RiskLevel, SeriesPoint } from '../types';

const PAGE = process.env.GPR_PAGE_URL || 'https://www.matteoiacoviello.com/gpr.htm';
const FALLBACK_FILE = 'https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls';

export interface GprRow extends SeriesPoint {
  event?: string;
}

type XlsxLike = {
  read: (data: Buffer | Uint8Array, opts: Record<string, unknown>) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (ws: unknown, opts: Record<string, unknown>) => unknown[][] };
};

/** Adres najnowszego pliku dziennego (nazwa zawiera datę, więc szukamy jej na stronie). */
export async function findGprFile(): Promise<string> {
  if (process.env.GPR_DAILY_URL) return process.env.GPR_DAILY_URL;
  try {
    const html = await fetchText(PAGE, 15_000);
    const m = html.match(/href\s*=\s*["']([^"']*data_gpr_daily_recent[^"']*\.xls)["']/i);
    if (m) return new URL(m[1], PAGE).toString();
  } catch {
    /* strona niedostępna — próbujemy stałej nazwy */
  }
  return FALLBACK_FILE;
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (v > 19000000 && v < 21000000) {
      const s = String(Math.round(v)); // RRRRMMDD
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10); // numer seryjny Excela
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/** Parsuje arkusz dzienny GPR: kolumna daty (DAY albo date) i GPRD; opcjonalnie kolumna z opisem zdarzenia. */
export function parseGprWorkbook(XLSX: XlsxLike, buf: Buffer | Uint8Array): GprRow[] {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as unknown[][];
    const hi = rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim().toUpperCase() === 'GPRD'));
    if (hi < 0) continue;
    const head = rows[hi].map((c) => String(c ?? '').trim().toUpperCase());
    const vi = head.indexOf('GPRD');
    const di = head.indexOf('DAY') >= 0 ? head.indexOf('DAY') : head.indexOf('DATE');
    const ei = head.indexOf('EVENT');
    if (di < 0) continue;
    const out: GprRow[] = [];
    for (const r of rows.slice(hi + 1)) {
      const date = toIsoDate(r[di]);
      const value = Number(r[vi]);
      if (!date || !Number.isFinite(value)) continue;
      const ev = ei >= 0 && r[ei] ? String(r[ei]).trim() : '';
      out.push(ev ? { date, value, event: ev } : { date, value });
    }
    if (out.length) return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  throw new Error('GPR: nie znaleziono kolumny GPRD w pliku');
}

export async function fetchGpr(): Promise<GprRow[]> {
  const url = await findGprFile();
  const buf = await fetchBuffer(url, 45_000);
  const mod = (await import('xlsx')) as unknown as Partial<XlsxLike> & { default?: XlsxLike };
  const XLSX = typeof mod.read === 'function' ? (mod as XlsxLike) : (mod.default as XlsxLike);
  return parseGprWorkbook(XLSX, buf);
}

export function gprLevel(ratio: number): RiskLevel {
  if (ratio >= 1.5) return 'HIGH';
  if (ratio >= 1.15) return 'ELEVATED';
  if (ratio <= 0.8) return 'LOW';
  return 'NORMAL';
}

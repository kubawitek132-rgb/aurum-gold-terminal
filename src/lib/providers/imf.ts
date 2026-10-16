/**
 * Provider: IMF — oficjalne rezerwy złota (dataset IRFCL, linia 56: złoto w uncjach trojańskich), miesięcznie, bez klucza.
 * API SDMX 2.1: https://api.imf.org/external/sdmx/2.1/data/IRFCL/{kraje}.IRFCLDT1_IRFCL56V_FTO..M
 * Zmiana m/m = zakupy (+) lub sprzedaż (−) złota przez bank centralny.
 *
 * Uwagi (znane wady danych IMF): część krajów zgłasza wartości w złej skali (np. Brazylia ×1000 od 2026-03),
 * dlatego odrzucamy wartości > 9000 t i skoki ×100 względem poprzedniego miesiąca. IRFCL nie obejmuje m.in.
 * Kanady, ZEA, Kataru i Kuwejtu.
 */
import { fetchText } from '../http';

export const OZ_PER_TONNE = 32_150.7466;
const MAX_T = 9_000;

/** Kraje: najwięksi posiadacze i aktywni kupujący. */
export const IMF_COUNTRIES: Record<string, string> = {
  USA: 'USA', DEU: 'Niemcy', ITA: 'Włochy', FRA: 'Francja', CHN: 'Chiny', CHE: 'Szwajcaria', IND: 'Indie', JPN: 'Japonia',
  NLD: 'Holandia', TUR: 'Turcja', POL: 'Polska', PRT: 'Portugalia', UZB: 'Uzbekistan', SAU: 'Arabia Saudyjska', GBR: 'Wielka Brytania',
  KAZ: 'Kazachstan', ESP: 'Hiszpania', AUT: 'Austria', THA: 'Tajlandia', BEL: 'Belgia', SGP: 'Singapur', CZE: 'Czechy',
  HUN: 'Węgry', BRA: 'Brazylia', IRQ: 'Irak', PHL: 'Filipiny', EGY: 'Egipt', SRB: 'Serbia', GHA: 'Ghana', KGZ: 'Kirgistan',
};

export interface ImfSeries {
  iso3: string;
  points: { period: string; tonnes: number }[]; // rosnąco po okresie, RRRR-MM
}

const normPeriod = (p: string) => {
  const m = p.match(/^(\d{4})-?M?(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

type RawObs = { iso3: string; period: string; value: number; mult: number };

function parseCsv(text: string): RawObs[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase());
  const ci = head.findIndex((h) => h === 'COUNTRY' || h === 'REF_AREA' || h === 'JURISDICTION');
  const ti = head.indexOf('TIME_PERIOD');
  const vi = head.indexOf('OBS_VALUE');
  const mi = head.indexOf('UNIT_MULT');
  if (ci < 0 || ti < 0 || vi < 0) throw new Error(`IMF CSV: nieznany układ kolumn (${head.slice(0, 8).join(',')})`);
  return lines.slice(1).map((l) => {
    const c = splitCsvLine(l);
    return { iso3: c[ci], period: c[ti], value: Number(c[vi]), mult: mi >= 0 ? Number(c[mi]) || 0 : 0 };
  });
}

/** SDMX-ML: format „structure specific” (atrybuty na Series/Obs) albo „generic” (elementy Value/ObsDimension/ObsValue). */
function parseXml(xml: string): RawObs[] {
  const out: RawObs[] = [];
  const seriesRe = /<(?:\w+:)?Series\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Series>/g;
  const attr = (s: string, name: string) => s.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  for (let m; (m = seriesRe.exec(xml)); ) {
    const [, attrs, body] = m;
    let iso3 = attr(attrs, 'COUNTRY') ?? attr(attrs, 'REF_AREA') ?? attr(attrs, 'JURISDICTION');
    if (!iso3) iso3 = body.match(/<(?:\w+:)?Value\s+id="(?:COUNTRY|REF_AREA|JURISDICTION)"\s+value="([^"]+)"/)?.[1];
    const mult = Number(attr(attrs, 'UNIT_MULT') ?? body.match(/<(?:\w+:)?Value\s+id="UNIT_MULT"\s+value="([^"]+)"/)?.[1] ?? 0) || 0;
    if (!iso3) continue;
    const obsRe = /<(?:\w+:)?Obs\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?Obs>)/g;
    for (let o; (o = obsRe.exec(body)); ) {
      const oa = o[1];
      const ob = o[2] ?? '';
      const period = attr(oa, 'TIME_PERIOD') ?? ob.match(/ObsDimension[^>]*value="([^"]+)"/)?.[1];
      const value = Number(attr(oa, 'OBS_VALUE') ?? ob.match(/ObsValue[^>]*value="([^"]+)"/)?.[1]);
      if (period && Number.isFinite(value)) out.push({ iso3, period, value, mult });
    }
  }
  return out;
}

/** Zamiana surowych obserwacji na serie w tonach z odrzuceniem błędów skali. */
export function toSeries(raw: RawObs[]): ImfSeries[] {
  const by = new Map<string, Map<string, number>>();
  for (const r of raw) {
    const p = normPeriod(r.period);
    if (!p || !Number.isFinite(r.value)) continue;
    const t = (r.value * 10 ** r.mult) / OZ_PER_TONNE;
    if (!(t >= 0 && t <= MAX_T)) continue;
    if (!by.has(r.iso3)) by.set(r.iso3, new Map());
    by.get(r.iso3)!.set(p, t);
  }
  const out: ImfSeries[] = [];
  for (const [iso3, m] of by) {
    const pts = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, tonnes]) => ({ period, tonnes }));
    // skoki o rząd wielkości (błąd jednostek w zgłoszeniu kraju) — zostawiamy poprzednią wartość
    const clean: { period: string; tonnes: number }[] = [];
    for (const p of pts) {
      const prev = clean.at(-1);
      if (prev && prev.tonnes > 1 && (p.tonnes / prev.tonnes > 20 || p.tonnes / prev.tonnes < 0.05)) continue;
      clean.push({ period: p.period, tonnes: +p.tonnes.toFixed(1) });
    }
    if (clean.length) out.push({ iso3, points: clean });
  }
  return out;
}

export function parseImf(text: string): ImfSeries[] {
  const t = text.trimStart();
  return toSeries(t.startsWith('<') ? parseXml(t) : parseCsv(t));
}

export async function fetchImfGold(months = 26): Promise<ImfSeries[]> {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  const start = d.toISOString().slice(0, 7);
  const keys = Object.keys(IMF_COUNTRIES).join('+');
  const base = process.env.IMF_API_BASE || 'https://api.imf.org/external/sdmx/2.1';
  const url = `${base}/data/IRFCL/${keys}.IRFCLDT1_IRFCL56V_FTO..M?startPeriod=${start}`;
  // najpierw CSV (prostszy), a gdy API go nie obsłuży — domyślny SDMX-ML
  let text: string;
  try {
    text = await fetchText(url, 45_000, { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0' });
    if (!text.trim() || /^\s*<!doctype html/i.test(text)) throw new Error('pusta odpowiedź CSV');
  } catch {
    text = await fetchText(url, 45_000, { Accept: 'application/vnd.sdmx.structurespecificdata+xml;version=2.1, application/xml' });
  }
  const series = parseImf(text);
  if (!series.length) throw new Error('IMF IRFCL: brak obserwacji w odpowiedzi');
  return series;
}

/**
 * Provider: GDELT DOC 2.0 API (bez klucza). Limit: ~1 zapytanie / 5 s → globalna kolejka.
 * DOC API nie zwraca współrzędnych — geotagujemy nagłówki gazeterem (src/lib/gazetteer.ts).
 */
import { fetchText, sleep } from '../http';
import { geocodeTitle } from '../gazetteer';
import { classifyGeo } from '../goldImpact';
import { jitter } from '../geo';
import type { GeoEvent } from '../types';

export interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language?: string;
  sourcecountry?: string;
}

const g = globalThis as unknown as { __gdeltQueue?: Promise<unknown>; __gdeltLast?: number };
const SPACING = 6000;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__gdeltQueue ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const wait = (g.__gdeltLast ?? 0) + SPACING - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        g.__gdeltLast = Date.now();
      }
    });
  g.__gdeltQueue = next;
  return next;
}

/**
 * GDELT przy przekroczeniu limitu odpowiada HTTP 200 z tekstem zamiast JSON.
 * Taki przypadek ponawiamy raz po odczekaniu, inne błędy przekazujemy dalej.
 */
async function gdeltJson<T>(url: string, timeoutMs: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const text = await enqueue(() => fetchText(url, timeoutMs));
    const t = text.trim();
    if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t) as T;
    if (t === '') return {} as T; // brak wyników
    if (attempt === 0 && /limit requests|too many/i.test(t)) {
      await sleep(SPACING);
      continue;
    }
    throw new Error(`GDELT: ${t.slice(0, 120)}`);
  }
}

export function parseSeenDate(s: string): number {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return Date.parse(s) || Date.now();
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export async function gdeltArticles(query: string, timespan = '24h', max = 250): Promise<GdeltArticle[]> {
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&sort=datedesc&maxrecords=${max}&timespan=${timespan}`;
  const raw = await gdeltJson<{ articles?: GdeltArticle[] }>(url, 20_000);
  const seen = new Set<string>();
  return (raw.articles ?? []).filter((a) => {
    const k = a.title?.toLowerCase().slice(0, 80);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const GEO_QUERY =
  process.env.GDELT_GEO_QUERY ||
  '(war OR airstrike OR missile OR sanctions OR tariff OR ceasefire OR "military strike" OR drone OR invasion) sourcelang:english';

export async function fetchGeoEvents(): Promise<GeoEvent[]> {
  const arts = await gdeltArticles(GEO_QUERY, '24h', 250);
  const out: GeoEvent[] = [];
  for (const a of arts) {
    const place = geocodeTitle(a.title);
    if (!place) continue;
    const c = classifyGeo(a.title);
    const [jx, jy] = jitter(a.url, 0.9);
    out.push({
      id: a.url,
      title: a.title,
      url: a.url,
      domain: a.domain,
      time: parseSeenDate(a.seendate),
      lat: place.lat + jy,
      lon: place.lon + jx,
      place: place.name,
      region: place.region,
      category: c.category,
      impact: c.impact,
    });
  }
  return out;
}

export const CHOKE_QUERY =
  '("strait of hormuz" OR "sea of oman" OR "gulf of oman" OR "bab el-mandeb" OR "red sea" OR houthi OR "suez canal" OR "strait of malacca" OR bosphorus OR "panama canal") sourcelang:english';

export function fetchChokepointArticles() {
  return gdeltArticles(CHOKE_QUERY, '48h', 250);
}

/**
 * Oś czasu intensywności relacji medialnych (mode=timelinevol) — % wszystkich artykułów GDELT
 * pasujących do zapytania. Agregujemy do wartości dziennych (średnia z punktów danego dnia).
 */
export async function gdeltTimeline(query: string, timespan = '30d'): Promise<{ dates: string[]; series: number[] }> {
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query + ' sourcelang:english')}` +
    `&mode=timelinevol&format=json&timespan=${timespan}`;
  const raw = await gdeltJson<{ timeline?: { series?: string; data?: { date: string; value: number }[] }[] }>(url, 25_000);
  const pts = raw.timeline?.[0]?.data ?? [];
  if (!pts.length) throw new Error('GDELT timeline: brak danych');
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const p of pts) {
    const d = `${p.date.slice(0, 4)}-${p.date.slice(4, 6)}-${p.date.slice(6, 8)}`;
    const e = byDay.get(d) ?? { sum: 0, n: 0 };
    e.sum += Number(p.value) || 0;
    e.n++;
    byDay.set(d, e);
  }
  const dates = [...byDay.keys()].sort();
  return { dates, series: dates.map((d) => +(byDay.get(d)!.sum / byDay.get(d)!.n).toFixed(5)) };
}

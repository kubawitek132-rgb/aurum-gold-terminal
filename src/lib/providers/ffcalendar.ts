/**
 * Provider: kalendarz ForexFactory (feed JSON faireconomy.media, bez klucza).
 * Uwaga: feed blokuje zbyt częste zapytania — odświeżamy co 30 min.
 * Feed nie zawiera pola "actual"; jeśli podłączysz inne źródło z odczytami, uzupełnij `actual`.
 */
import { fetchJson } from '../http';
import type { CalendarEvent } from '../types';
import { calendarGoldNote } from '../goldImpact';
import currencyGeo from '@/data/currency-geo.json';

interface FfItem {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

const PRIMARY = process.env.FF_CALENDAR_URL || 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FALLBACK = process.env.FF_CALENDAR_FALLBACK_URL || 'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json';
const NEXT_WEEK = process.env.FF_CALENDAR_NEXTWEEK_URL || 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function mapFfItems(items: FfItem[]): CalendarEvent[] {
  const geo = currencyGeo as Record<string, { country: string; lat: number; lon: number }>;
  const out: CalendarEvent[] = [];
  for (const it of items) {
    if (it.impact !== 'High' && it.impact !== 'Medium') continue;
    const t = Date.parse(it.date);
    if (!Number.isFinite(t)) continue;
    const g = geo[it.country] ?? geo.ALL;
    const n = calendarGoldNote(it.title, it.country, it.actual ?? '', it.forecast ?? '');
    out.push({
      id: hash(`${it.title}|${it.country}|${it.date}`),
      title: it.title,
      currency: it.country,
      country: g.country,
      time: t,
      impact: it.impact as CalendarEvent['impact'],
      forecast: it.forecast ?? '',
      previous: it.previous ?? '',
      actual: it.actual ?? '',
      lat: g.lat,
      lon: g.lon,
      goldNote: n.note,
      goldImpact: n.impact,
      sourceUrl: 'https://www.forexfactory.com/calendar',
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

async function tryUrls(urls: string[]): Promise<FfItem[]> {
  let lastErr: unknown;
  for (const u of urls) {
    try {
      const data = await fetchJson<FfItem[]>(u, 12_000);
      if (Array.isArray(data)) return data;
      lastErr = new Error('nieoczekiwany format');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchCalendar(): Promise<CalendarEvent[]> {
  const thisWeek = await tryUrls([PRIMARY, FALLBACK]);
  let nextWeek: FfItem[] = [];
  try {
    nextWeek = await fetchJson<FfItem[]>(NEXT_WEEK, 10_000);
    if (!Array.isArray(nextWeek)) nextWeek = [];
  } catch {
    /* feed następnego tygodnia bywa niedostępny — ignorujemy */
  }
  const seen = new Set<string>();
  return mapFfItems([...thisWeek, ...nextWeek]).filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

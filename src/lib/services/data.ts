/**
 * Serwisy łączące providery z cache. API routes i scheduler korzystają tylko z tego modułu.
 * Podmiana źródła = zmiana providera w jednym miejscu.
 */
import { cached } from '../cache';
import type {
  CalendarEvent,
  CentralBank,
  Chokepoint,
  GeoEvent,
  GoldCalEvent,
  HubsData,
  PolicyPulse,
  PolicyStance,
  RegionRisk,
  RiskLevel,
  SeasonalityData,
  SourceResult,
  CbGoldData,
} from '../types';
import { fetchCalendar } from '../providers/ffcalendar';
import { fetchChokepointArticles, fetchGeoEvents, gdeltTimeline, parseSeenDate, type GdeltArticle } from '../providers/gdelt';
import { aisCounts, aisEnabled } from '../providers/aisstream';
import { lastLevelChange } from '../providers/fred';
import { peek } from '../cache';
import { computeFedExpect } from './macro';
import type { SeriesPoint } from '../types';
import { tdConfigured, tdMonthly } from '../providers/twelvedata';
import { calendarGoldNote } from '../goldImpact';
import { goldCalendar } from '../goldCalendar';
import { sleep } from '../http';
import banksJson from '@/data/central-banks.json';
import goldMarket from '@/data/gold-market.json';
import reservesJson from '@/data/reserves.json';
import chokeJson from '@/data/chokepoints.json';
import regionsJson from '@/data/regions.json';
import currencyGeo from '@/data/currency-geo.json';

const MIN = 60_000;
const DAY = 86_400_000;

/* ───────────── BANKI CENTRALNE ───────────── */
type BankJson = Omit<CentralBank, 'lastDecision' | 'nextDecision' | 'stance'>;
const STANCE_WINDOW_DAYS = 180;

function stanceOf(b: BankJson, now: number): PolicyStance {
  if (!b.lastChange) return 'unknown';
  const age = now - Date.parse(b.lastChange.date);
  if (age > STANCE_WINDOW_DAYS * DAY) return 'hold';
  return b.lastChange.bps > 0 ? 'tightening' : b.lastChange.bps < 0 ? 'easing' : 'hold';
}

/** Ostatnie prawdziwe (nie zastępcze) dane serii FRED z cache — bez wywoływania sieci. */
function fredPeek(id: string): SeriesPoint[] | null {
  const v = peek<SeriesPoint[]>(`fred:${id}`);
  return v && !v.missing && v.data.length ? v.data : null;
}

const pct = (v: number) => `${v.toFixed(2)}%`;

/** Fed i ECB: stopa i data ostatniej zmiany automatycznie z FRED (DFEDTARU/DFEDTARL, ECBDFR). */
function autoRate(b: BankJson): Partial<BankJson> | null {
  if (b.id === 'fed') {
    const u = fredPeek('DFEDTARU');
    const l = fredPeek('DFEDTARL');
    const ch = u && lastLevelChange(u);
    if (!u || !l || !ch) return null;
    return {
      rate: u.at(-1)!.value,
      rateLabel: `${pct(l.at(-1)!.value)}–${pct(u.at(-1)!.value)} (fed funds target)`,
      lastChange: { date: ch.date, bps: ch.bps },
      auto: 'FRED: DFEDTARU/DFEDTARL (data zmiany = dzień wejścia w życie)',
    };
  }
  if (b.id === 'ecb') {
    const d = fredPeek('ECBDFR');
    const ch = d && lastLevelChange(d);
    if (!d || !ch) return null;
    const v = d.at(-1)!.value;
    return {
      rate: v,
      rateLabel: `${pct(v)} (depozytowa) / ${pct(v + 0.15)} (MRO)`,
      lastChange: { date: ch.date, bps: ch.bps },
      auto: 'FRED: ECBDFR (data zmiany = dzień wejścia w życie)',
    };
  }
  return null;
}

export function getBanks(): SourceResult<CentralBank[]> & { asOf: string } {
  const now = Date.now();
  const banks = (banksJson.banks as BankJson[]).map((b0) => {
    const auto = autoRate(b0);
    const b = auto ? { ...b0, ...auto } : b0;
    const times = b.meetings.map((m) => Date.parse(m)).filter(Number.isFinite).sort((a, c) => a - c);
    const past = times.filter((t) => t <= now);
    const future = times.filter((t) => t > now);
    // posiedzenie odbyło się po dacie aktualizacji pliku → wynik (lastChange) trzeba wpisać ręcznie
    const missed = b.auto ? [] : past.filter((t) => t > Date.parse(banksJson.asOf) + DAY);
    const verify = missed.length
      ? `zaktualizuj po posiedzeniu z ${new Date(missed[missed.length - 1]).toISOString().slice(0, 10)}: lastChange (jeśli była zmiana) i asOf${b.verify ? '; ' + b.verify : ''}`
      : b.verify;
    return {
      ...b,
      verify,
      lastDecision: past.length ? new Date(past[past.length - 1]).toISOString() : null,
      nextDecision: future.length ? new Date(future[0]).toISOString() : null,
      stance: stanceOf(b, now),
    } as CentralBank;
  });
  return {
    data: banks,
    source: 'statyczny JSON (src/data/central-banks.json)',
    updatedAt: Date.parse(banksJson.asOf),
    stale: now - Date.parse(banksJson.asOf) > 120 * DAY || banks.some((b) => !b.nextDecision),
    asOf: banksJson.asOf,
  };
}

/** Globalny puls polityki pieniężnej: kto podnosi, kto tnie, co w najbliższych 30 dniach. */
export function getPolicyPulse(): SourceResult<PolicyPulse> {
  const banks = getBanks();
  const now = Date.now();
  const hikes: PolicyPulse['hikes'] = [];
  const cuts: PolicyPulse['cuts'] = [];
  const holds: string[] = [];
  const unknown: string[] = [];
  for (const b of banks.data) {
    if (b.stance === 'tightening' && b.lastChange) hikes.push({ short: b.short, bps: b.lastChange.bps, date: b.lastChange.date });
    else if (b.stance === 'easing' && b.lastChange) cuts.push({ short: b.short, bps: b.lastChange.bps, date: b.lastChange.date });
    else if (b.stance === 'hold') holds.push(b.short);
    else unknown.push(b.short);
  }
  const label =
    hikes.length > cuts.length + 1 ? 'ZACIEŚNIANIE' : cuts.length > hikes.length + 1 ? 'LUZOWANIE' : hikes.length || cuts.length ? 'MIESZANY' : 'PAUZA';
  const note =
    label === 'ZACIEŚNIANIE'
      ? 'Przewaga podwyżek: wyższe stopy realne na świecie podnoszą koszt trzymania złota. Wsparciem pozostają zakupy banków centralnych.'
      : label === 'LUZOWANIE'
        ? 'Przewaga obniżek: niższe stopy realne i słabsze waluty fiat zwykle sprzyjają złotu.'
        : 'Brak wyraźnego globalnego kierunku — rozstrzyga Fed i dolar.';
  const upcoming = banks.data
    .filter((b) => b.nextDecision && Date.parse(b.nextDecision) - now < 30 * DAY)
    .map((b) => ({ id: b.id, short: b.short, currency: b.currency, time: Date.parse(b.nextDecision!), rateLabel: b.rateLabel, stance: b.stance }))
    .sort((a, b) => a.time - b.time);
  const buyers = banks.data.filter((b) => b.goldTrend === 'buying').map((b) => b.short);
  const dff = fredPeek('DFF');
  const d1 = fredPeek('DGS1');
  const d2 = fredPeek('DGS2');
  const fedExpect = dff && d1 && d2 ? computeFedExpect(dff, d1, d2) : null;
  return {
    data: { windowDays: STANCE_WINDOW_DAYS, hikes, cuts, holds, unknown, label, note, upcoming, buyers, fedExpect },
    source: banks.source,
    updatedAt: banks.updatedAt,
    stale: banks.stale,
  };
}

/* ───────────── KALENDARZ GLOBALNY (decyzje banków + publikacje spoza USD) ───────────── */
const BANK_EVENT_RE = /rate|decision|statement|policy|cash rate|lpr|press conference/i;
const INCLUDE_USD = process.env.CALENDAR_INCLUDE_USD === 'true';

export function bankEvents(windowDays = 30): CalendarEvent[] {
  const now = Date.now();
  const geo = currencyGeo as Record<string, { country: string; lat: number; lon: number }>;
  const out: CalendarEvent[] = [];
  for (const b of banksJson.banks as BankJson[]) {
    for (const m of b.meetings) {
      const t = Date.parse(m);
      if (!Number.isFinite(t) || t < now - 2 * DAY || t > now + windowDays * DAY) continue;
      const g = geo[b.currency] ?? { country: b.country, lat: b.lat, lon: b.lon };
      const n = calendarGoldNote(`${b.short} rate decision`, b.currency, '', '');
      out.push({
        id: `cb-${b.id}-${m}`,
        title: `${b.short} — decyzja w sprawie stóp`,
        currency: b.currency,
        country: g.country,
        time: t,
        impact: 'High',
        forecast: '',
        previous: b.rateLabel,
        actual: '',
        lat: g.lat,
        lon: g.lon,
        goldNote: n.note,
        goldImpact: 'NEUTRAL',
        sourceUrl: b.url,
        kind: 'cb',
      });
    }
  }
  return out;
}

/**
 * Publikacje USD obsługuje GOLD DESK — tu zostają decyzje banków (w tym Fed)
 * i publikacje spoza USD (CALENDAR_INCLUDE_USD=true dołącza też USD).
 */
export function mergeCalendar(ff: CalendarEvent[]): CalendarEvent[] {
  const banks = bankEvents();
  const nonUsd = ff
    .filter((e) => INCLUDE_USD || e.currency !== 'USD')
    .filter((e) => !(BANK_EVENT_RE.test(e.title) && banks.some((b) => b.currency === e.currency && Math.abs(b.time - e.time) < 3 * 3600000)))
    .map((e) => ({ ...e, kind: 'macro' as const }));
  return [...nonUsd, ...banks].sort((a, b) => a.time - b.time);
}

export function getCalendar(): Promise<SourceResult<CalendarEvent[]>> {
  return cached(
    'calendar',
    async () => ({ data: mergeCalendar(await fetchCalendar()), source: 'decyzje banków (JSON) + ForexFactory (spoza USD)' }),
    {
      ttlMs: 30 * MIN,
      retryMs: 10 * MIN,
      // bez ForexFactory zostają prawdziwe daty decyzji banków — to nie są dane zastępcze
      fallback: () => ({ data: mergeCalendar([]), source: 'decyzje banków (JSON); ForexFactory chwilowo niedostępny', missing: false }),
    },
  );
}

/* ───────────── KALENDARZ STRUKTURALNY ZŁOTA ───────────── */
export function getGoldCalendar(days = 60): SourceResult<GoldCalEvent[]> {
  return { data: goldCalendar(days), source: 'reguły CME + JSON (src/data/gold-calendar.json)', updatedAt: Date.now(), stale: false };
}

/* ───────────── GEOPOLITYKA ───────────── */
export function getGeo(): Promise<SourceResult<GeoEvent[]>> {
  return cached('gdelt:geo', async () => ({ data: await fetchGeoEvents(), source: 'GDELT DOC 2.0' }), {
    ttlMs: 15 * MIN,
    retryMs: 5 * MIN,
    fallback: () => ({ data: [], source: 'GDELT chwilowo niedostępny' }),
  });
}

type RegionJson = { id: string; name: string; lat: number; lon: number; q: string; gold: string };

export function levelOf(ratio: number | null): RiskLevel {
  if (ratio === null) return 'UNKNOWN';
  if (ratio >= 1.5) return 'HIGH';
  if (ratio >= 1.15) return 'ELEVATED';
  if (ratio <= 0.8) return 'LOW';
  return 'NORMAL';
}

/** Ostatnie 3 dni vs średnia z wcześniejszych dni okna. */
export function regionIndex(series: number[]): number | null {
  if (series.length < 10) return null;
  const recent = series.slice(-3);
  const base = series.slice(0, -3);
  const r = recent.reduce((s, x) => s + x, 0) / recent.length;
  const b = base.reduce((s, x) => s + x, 0) / base.length;
  return b > 0 ? +(r / b).toFixed(2) : null;
}

/** Indeks ryzyka per region: intensywność relacji (GDELT timelinevol, 30 dni). */
export function getRegions(): Promise<SourceResult<RegionRisk[]>> {
  const regions = regionsJson.regions as RegionJson[];
  return cached(
    'gdelt:regions',
    async () => {
      const out: RegionRisk[] = [];
      let failed = 0;
      for (const r of regions) {
        // błąd jednego regionu nie może wyzerować całej warstwy
        let tl: { dates: string[]; series: number[] } = { dates: [], series: [] };
        try {
          tl = await gdeltTimeline(r.q, '30d');
        } catch (e) {
          failed++;
          console.warn(`[regions] ${r.id}: ${e instanceof Error ? e.message : e}`);
        }
        const ratio = regionIndex(tl.series);
        out.push({ id: r.id, name: r.name, lat: r.lat, lon: r.lon, level: levelOf(ratio), ratio, series: tl.series, dates: tl.dates, gold: r.gold, query: r.q });
        await sleep(200);
      }
      if (failed === regions.length) throw new Error('GDELT: żaden region nie odpowiedział');
      return { data: out, source: `GDELT DOC 2.0 (timelinevol, 30 dni)${failed ? ` · brak danych dla ${failed} reg.` : ''}` };
    },
    {
      ttlMs: 3 * 3600_000,
      retryMs: 20 * MIN,
      fallback: () => ({
        data: regions.map((r) => ({
          id: r.id, name: r.name, lat: r.lat, lon: r.lon, level: 'UNKNOWN' as RiskLevel, ratio: null, series: [], dates: [], gold: r.gold, query: r.q,
        })),
        source: 'GDELT chwilowo niedostępny',
      }),
    },
  );
}

/* ───────────── CHOKEPOINTY ───────────── */
const DISRUPT = /(attack|attacked|seiz|clos|block|disrupt|drone|missile|mine[sd]?\b|hijack|divert|rerout|suspend|halt|shut|strike|explosion|fire|drought|restrict|congest|delay)/i;

type ChokeJson = { id: string; name: string; lat: number; lon: number; keys: string[]; oilShare: string; description: string };

export async function getChokepoints(): Promise<SourceResult<Chokepoint[]>> {
  const arts = await cached<GdeltArticle[]>('gdelt:choke', async () => ({ data: await fetchChokepointArticles(), source: 'GDELT DOC 2.0' }), {
    ttlMs: 30 * MIN,
    retryMs: 10 * MIN,
    fallback: () => ({ data: [], source: 'brak danych' }),
  });
  const ais = aisEnabled() ? aisCounts() : {};
  const elevated = Number(process.env.CHOKE_ELEVATED ?? 1);
  const disrupted = Number(process.env.CHOKE_DISRUPTED ?? 4);
  const data: Chokepoint[] = (chokeJson.chokepoints as ChokeJson[]).map((c) => {
    const hits = arts.data.filter((a) => {
      const t = a.title.toLowerCase();
      return c.keys.some((k) => t.includes(k)) && DISRUPT.test(t);
    });
    const n = hits.length;
    const status: Chokepoint['status'] = arts.missing ? 'UNKNOWN' : n >= disrupted ? 'DISRUPTED' : n >= elevated ? 'ELEVATED' : 'NORMAL';
    return {
      id: c.id,
      name: c.name,
      lat: c.lat,
      lon: c.lon,
      description: c.description,
      oilShare: c.oilShare,
      status,
      mentions: n,
      headlines: hits.slice(0, 5).map((h) => ({ title: h.title, url: h.url, time: parseSeenDate(h.seendate) })),
      ais: ais[c.id] ?? null,
      impact: status === 'ELEVATED' || status === 'DISRUPTED' ? 'BULLISH' : 'NEUTRAL',
    };
  });
  return { ...arts, data, source: arts.missing ? 'brak danych GDELT' : arts.source + (aisEnabled() ? ' + aisstream.io' : '') };
}

/* ───────────── RYNEK FIZYCZNY + REZERWY (statyczne) ───────────── */
export function getHubs(): SourceResult<HubsData> {
  // rezerwy: najnowsze dane miesięczne IMF (gdy już pobrane), uzupełnione przybliżeniami WGC z JSON
  const imf = peek<CbGoldData | null>('imf:gold');
  const live = imf && !imf.missing && imf.data ? new Map(imf.data.rows.map((r) => [r.iso3, r])) : null;
  const reserves = (reservesJson.reserves as HubsData['reserves']).map((r) => {
    const x = live?.get((r as { iso3?: string }).iso3 ?? '');
    return x ? { ...r, tonnes: Math.round(x.tonnes), trend: (x.change12m ?? 0) >= 1 ? 'buying' : (x.change12m ?? 0) <= -1 ? 'selling' : 'stable' } : r;
  }) as HubsData['reserves'];
  return {
    data: {
      hubs: goldMarket.hubs,
      flows: goldMarket.flows,
      producers: goldMarket.producers,
      producersAsOf: goldMarket.producersAsOf,
      reserves,
      reservesAsOf: live ? `IMF IRFCL ${imf!.data!.latestPeriod} + WGC (kraje spoza IRFCL)` : reservesJson.asOf,
    },
    source: 'statyczny JSON (gold-market.json, reserves.json)',
    updatedAt: null,
    stale: false,
  };
}

/* ───────────── SEZONOWOŚĆ ───────────── */
export async function getSeasonality(): Promise<SourceResult<SeasonalityData | null>> {
  if (!tdConfigured()) {
    return { data: null, source: 'wymaga TWELVEDATA_API_KEY (1 zapytanie na dobę)', updatedAt: null, stale: false };
  }
  return cached<SeasonalityData | null>(
    'td:xau:monthly',
    async () => {
      const pts = await tdMonthly('XAU/USD', 300);
      const buckets: number[][] = Array.from({ length: 12 }, () => []);
      const thisMonth = new Date().toISOString().slice(0, 7);
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].date.slice(0, 7) === thisMonth) continue; // bieżący, niezamknięty miesiąc
        const m = Number(pts[i].date.slice(5, 7)) - 1;
        buckets[m].push(((pts[i].value - pts[i - 1].value) / pts[i - 1].value) * 100);
      }
      const median = (a: number[]) => {
        const s = [...a].sort((x, y) => x - y);
        return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
      };
      return {
        data: {
          months: buckets.map((b, m) => ({
            m,
            avg: b.length ? +(b.reduce((s, x) => s + x, 0) / b.length).toFixed(2) : 0,
            median: +median(b).toFixed(2),
            positive: b.length ? Math.round((b.filter((x) => x > 0).length / b.length) * 100) : 0,
            n: b.length,
          })),
          years: `${pts[0]?.date.slice(0, 4)}–${pts[pts.length - 1]?.date.slice(0, 4)}`,
          currentMonth: new Date().getUTCMonth(),
        },
        source: 'Twelve Data (XAU/USD, zamknięcia miesięczne)',
      };
    },
    { ttlMs: 24 * 3600_000, retryMs: 60 * MIN, fallback: () => ({ data: null, source: 'Twelve Data chwilowo niedostępne' }) },
  );
}

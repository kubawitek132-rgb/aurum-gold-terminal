/** Budowanie treści popupów (styl OSIRIS) z danych warstw. */
import type { CalendarEvent, CentralBank, Chokepoint, GeoEvent, GoldCalEvent, GoldImpact, HubsData, RegionRisk, TapeItem } from './types';
import { subsolarPoint } from './geo';
import { fmtAgo, fmtCountdown, fmtDateTime, WARSAW } from './time';
import { CHOKE_COLOR, LEVEL_COLOR, LEVEL_LABEL, STANCE_LABEL } from './layers';

export interface PopupRow {
  k: string;
  v: string;
  tone?: 'up' | 'down' | 'warn' | 'gold' | 'data' | 'muted';
}

export interface PopupData {
  kind: string;
  tag: string;
  title: string;
  subtitle?: string;
  color: string;
  rows: PopupRow[];
  impact?: GoldImpact;
  impactNote?: string;
  body?: string;
  spark?: { values: number[]; label: string };
  links?: { label: string; url: string }[];
  sourceUrl?: string;
  footer?: string;
}

export interface PopupContext {
  now: number;
  banks: CentralBank[];
  calendar: CalendarEvent[];
  geo: GeoEvent[];
  regions: RegionRisk[];
  choke: Chokepoint[];
  hubs: HubsData | null;
  goldcal: GoldCalEvent[];
  tape: TapeItem[];
}

const GEO_NOTES: Record<GeoEvent['category'], string> = {
  conflict: 'Eskalacja konfliktu zwykle podnosi premię za ryzyko → popyt na bezpieczną przystań (XAU ↑).',
  sanctions: 'Sankcje zwiększają niepewność i motywują banki centralne do dywersyfikacji poza USD → wsparcie dla złota.',
  trade: 'Cła i wojny handlowe → ryzyko inflacji i spowolnienia → zwykle wsparcie dla złota.',
  diplomacy: 'Deeskalacja / rozejm zdejmuje premię geopolityczną → krótkoterminowo negatywne dla XAU.',
  other: 'Wpływ niejednoznaczny.',
};

const EUROZONE = [
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Portugal', 'Ireland', 'Finland', 'Greece',
  'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Croatia', 'Malta', 'Cyprus',
];
export const COUNTRY_CCY: Record<string, string> = {
  'United States of America': 'USD', 'United States': 'USD', 'United Kingdom': 'GBP', Japan: 'JPY', Switzerland: 'CHF',
  Canada: 'CAD', Australia: 'AUD', 'New Zealand': 'NZD', China: 'CNY', Poland: 'PLN', India: 'INR', Russia: 'RUB', Brazil: 'BRL',
  ...Object.fromEntries(EUROZONE.map((c) => [c, 'EUR'])),
};
const SANCTIONED = ['Russia', 'Belarus', 'Iran', 'North Korea', 'Venezuela', 'Cuba'];
/** Kraj → region ryzyka (id z regions.json). */
const COUNTRY_REGION: Record<string, string> = {
  Iran: 'mideast', Israel: 'mideast', Lebanon: 'mideast', Syria: 'mideast', Iraq: 'mideast', Jordan: 'mideast', Palestine: 'mideast',
  'Saudi Arabia': 'mideast', 'United Arab Emirates': 'mideast', Qatar: 'mideast', Oman: 'mideast', Kuwait: 'mideast',
  Russia: 'ruukr', Ukraine: 'ruukr', Belarus: 'ruukr', Moldova: 'ruukr', Poland: 'ruukr',
  Taiwan: 'taiwan', China: 'taiwan', Philippines: 'taiwan', Vietnam: 'taiwan',
  Yemen: 'redsea', Eritrea: 'redsea', Djibouti: 'redsea', Somalia: 'redsea', Sudan: 'redsea', Egypt: 'redsea',
  'North Korea': 'korea', 'South Korea': 'korea',
};

function distKm(a: [number, number], b: [number, number]) {
  const R = Math.PI / 180;
  const h = Math.sin(((b[1] - a[1]) * R) / 2) ** 2 + Math.cos(a[1] * R) * Math.cos(b[1] * R) * Math.sin(((b[0] - a[0]) * R) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function tapeRow(label: string, t: TapeItem | undefined): PopupRow[] {
  if (!t || t.value === null) return [];
  const c = t.change;
  return [
    {
      k: label,
      v: `$${t.value.toFixed(2)} (${c === null ? '—' : (c > 0 ? '+' : '') + c.toFixed(1) + '% tydz.'})`,
      tone: c && c > 0 ? 'up' : c && c < 0 ? 'down' : 'muted',
    },
  ];
}

const fmtDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', weekday: 'short' });

/** Przypisanie zdarzenia GEO do regionu ryzyka po miejscu z gazetera. */
export function regionOfEvent(e: GeoEvent): string | null {
  const p = e.place.toLowerCase();
  if (/(gaza|west bank|lebanon|yemen|tehran|iran|israel|syria|iraq|saudi|qatar|uae|hormuz)/.test(p)) return 'mideast';
  if (/(red sea|suez|sudan|somalia|ethiopia|egypt)/.test(p)) return 'redsea';
  if (/(kyiv|kharkiv|donbas|crimea|odesa|ukraine|moscow|russia|belarus|black sea|baltic|poland)/.test(p)) return 'ruukr';
  if (/(taiwan|south china sea|beijing|shanghai|china|philippines)/.test(p)) return 'taiwan';
  if (/(north korea|south korea)/.test(p)) return 'korea';
  if (e.category === 'trade' || e.category === 'sanctions') return 'trade';
  return null;
}

export function buildPopup(kind: string, id: string, ctx: PopupContext): PopupData | null {
  const { now } = ctx;
  switch (kind) {
    case 'bank': {
      const b = ctx.banks.find((x) => x.id === id);
      if (!b) return null;
      const next = b.nextDecision ? Date.parse(b.nextDecision) : null;
      const trend = b.goldTrend === 'buying' ? 'KUPUJE ▲' : b.goldTrend === 'selling' ? 'SPRZEDAJE ▼' : 'STABILNIE ■';
      return {
        kind,
        tag: 'CENTRAL BANK',
        title: `${b.short} — ${b.name}`,
        subtitle: `${b.city} · ${b.currency}`,
        color: '#D4AF37',
        rows: [
          { k: 'STOPA', v: b.rateLabel, tone: 'gold' },
          ...(b.auto ? [{ k: 'ŹRÓDŁO STOPY', v: 'FRED — aktualizacja automatyczna', tone: 'data' as const }] : []),
          { k: 'KIERUNEK (180 DNI)', v: STANCE_LABEL[b.stance], tone: b.stance === 'tightening' ? 'down' : b.stance === 'easing' ? 'up' : 'muted' },
          {
            k: 'OSTATNIA ZMIANA',
            v: b.lastChange ? `${b.lastChange.bps > 0 ? '+' : ''}${b.lastChange.bps} bp (${b.lastChange.date})` : 'do weryfikacji',
            tone: b.lastChange ? (b.lastChange.bps > 0 ? 'down' : 'up') : 'muted',
          },
          { k: 'OSTATNIA DECYZJA', v: b.lastDecision ? fmtDateTime(Date.parse(b.lastDecision)) : '—' },
          { k: 'NASTĘPNA DECYZJA', v: next ? fmtDateTime(next) : 'brak daty w JSON', tone: next ? 'data' : 'warn' },
          { k: 'ODLICZANIE', v: next ? fmtCountdown(next - now) : '—', tone: 'warn' },
          { k: 'REZERWY ZŁOTA', v: b.goldReservesT !== null ? `${b.goldReservesT.toLocaleString('pl-PL')} t` : '—', tone: 'gold' },
          { k: 'TREND REZERW', v: trend, tone: b.goldTrend === 'buying' ? 'up' : b.goldTrend === 'selling' ? 'down' : 'muted' },
        ],
        impact: b.goldTrend === 'buying' ? 'BULLISH' : b.stance === 'tightening' ? 'BEARISH' : 'NEUTRAL',
        impactNote:
          (b.goldTrend === 'buying' ? 'Zakupy oficjalne to strukturalne wsparcie popytu na złoto. ' : '') +
          (b.stance === 'tightening'
            ? 'Cykl podwyżek podnosi stopy realne — przeciwny wiatr dla złota w tej walucie.'
            : b.stance === 'easing'
              ? 'Cykl obniżek obniża koszt alternatywny trzymania złota.'
              : 'Pauza w polityce — wpływ zależy od kolejnych sygnałów banku.'),
        body: b.goldNote,
        sourceUrl: b.url,
        footer: b.verify ? `⚠ do weryfikacji: ${b.verify}` : undefined,
      };
    }
    case 'cal': {
      const e = ctx.calendar.find((x) => x.id === id);
      if (!e) return null;
      const dt = e.time - now;
      const extra: PopupRow[] =
        e.kind === 'cb'
          ? [{ k: 'OBECNA STOPA', v: e.previous || '—', tone: 'gold' }]
          : [
              { k: 'WAGA', v: e.impact.toUpperCase(), tone: e.impact === 'High' ? 'down' : 'warn' },
              { k: 'PROGNOZA', v: e.forecast || '—' },
              { k: 'POPRZEDNIO', v: e.previous || '—' },
            ];
      return {
        kind,
        tag: e.kind === 'cb' ? 'RATE DECISION' : 'MACRO EVENT',
        title: `${e.currency} · ${e.title}`,
        subtitle: e.country,
        color: e.kind === 'cb' ? '#D4AF37' : e.impact === 'High' ? '#ef4444' : '#f59e0b',
        rows: [
          { k: 'CZAS (WAW)', v: fmtDateTime(e.time, WARSAW), tone: 'data' },
          { k: dt >= 0 ? 'ZA' : 'MINĘŁO', v: dt >= 0 ? fmtCountdown(dt) : fmtAgo(e.time, now), tone: 'warn' },
          ...extra,
        ],
        impact: e.goldImpact,
        impactNote: e.goldNote,
        sourceUrl: e.sourceUrl,
      };
    }
    case 'risk': {
      const r = ctx.regions.find((x) => x.id === id);
      if (!r) return null;
      const evs = ctx.geo.filter((g) => regionOfEvent(g) === r.id).slice(0, 5);
      return {
        kind,
        tag: 'REGIONAL RISK',
        title: r.name,
        subtitle: `poziom ${LEVEL_LABEL[r.level]}`,
        color: LEVEL_COLOR[r.level],
        rows: [
          { k: 'POZIOM', v: LEVEL_LABEL[r.level], tone: r.level === 'HIGH' ? 'down' : r.level === 'ELEVATED' ? 'warn' : r.level === 'LOW' ? 'up' : 'muted' },
          { k: 'INDEKS (3 DNI / ŚREDNIA)', v: r.ratio === null ? '—' : `×${r.ratio.toFixed(2)}`, tone: 'data' },
          { k: 'ZDARZENIA 24H NA MAPIE', v: String(evs.length) },
        ],
        spark: { values: r.series, label: 'intensywność relacji · 30 dni' },
        impact: r.level === 'HIGH' || r.level === 'ELEVATED' ? 'BULLISH' : r.level === 'LOW' ? 'BEARISH' : 'NEUTRAL',
        impactNote: r.gold,
        links: evs.map((g) => ({ label: g.title, url: g.url })),
        sourceUrl: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(r.query)}&mode=timelinevol&timespan=30d`,
        footer: 'Indeks = intensywność relacji z ostatnich 3 dni względem średniej z 30 dni (GDELT). Mierzy uwagę mediów, nie skalę zdarzeń.',
      };
    }
    case 'geo': {
      const e = ctx.geo.find((x) => x.id === id);
      if (!e) return null;
      return {
        kind,
        tag: 'GEOPOLITICAL EVENT',
        title: e.title,
        subtitle: `${e.place}${e.region ? ' · ' + e.region : ''}`,
        color: '#ef4444',
        rows: [
          { k: 'KATEGORIA', v: e.category.toUpperCase(), tone: e.category === 'diplomacy' ? 'up' : 'down' },
          { k: 'ŹRÓDŁO', v: e.domain, tone: 'data' },
          { k: 'WYKRYTO', v: `${fmtDateTime(e.time)} (${fmtAgo(e.time, now)})` },
        ],
        impact: e.impact,
        impactNote: GEO_NOTES[e.category] + ' (klasyfikacja heurystyczna po słowach kluczowych)',
        sourceUrl: e.url,
        footer: 'Geotag na podstawie nazwy miejsca w nagłówku (GDELT DOC).',
      };
    }
    case 'choke': {
      const c = ctx.choke.find((x) => x.id === id);
      if (!c) return null;
      return {
        kind,
        tag: 'CHOKEPOINT',
        title: c.name,
        subtitle: c.oilShare,
        color: CHOKE_COLOR[c.status],
        rows: [
          { k: 'STATUS', v: c.status === 'UNKNOWN' ? 'BRAK DANYCH' : c.status, tone: c.status === 'NORMAL' ? 'up' : c.status === 'ELEVATED' ? 'warn' : c.status === 'UNKNOWN' ? 'muted' : 'down' },
          { k: 'WZMIANKI 48H', v: String(c.mentions), tone: 'data' },
          ...(c.ais ? [{ k: `AIS (${c.ais.windowMin} min)`, v: `${c.ais.vessels} jednostek, w tym ${c.ais.tankers} tankowców`, tone: 'data' as const }] : []),
          ...tapeRow('BRENT', ctx.tape.find((t) => t.symbol === 'BRENT')),
          ...tapeRow('WTI', ctx.tape.find((t) => t.symbol === 'WTI')),
        ],
        body: c.description,
        impact: c.impact,
        impactNote: 'Zakłócenia → ropa ↑ → oczekiwania inflacyjne ↑ → wsparcie dla złota (plus premia za ryzyko).',
        links: c.headlines.map((h) => ({ label: h.title, url: h.url })),
        sourceUrl: c.headlines[0]?.url,
        footer: 'Status wyznaczany z liczby nagłówków o zakłóceniach (GDELT, 48h).',
      };
    }
    case 'hub': {
      const h = ctx.hubs?.hubs.find((x) => x.id === id);
      if (!h) return null;
      const flows = ctx.hubs!.flows.filter((f) => f.from === id || f.to === id);
      const names = Object.fromEntries(ctx.hubs!.hubs.map((x) => [x.id, x.name]));
      const evs = ctx.goldcal.filter((e) => e.venue === id).slice(0, 5);
      return {
        kind,
        tag: 'GOLD HUB',
        title: h.name,
        subtitle: h.venue,
        color: '#D4AF37',
        rows: [
          { k: 'PREMIA / DYSKONTO', v: h.premium ?? 'n/d — uzupełniana ręcznie', tone: h.premium ? 'gold' : 'muted' },
          { k: 'PRZEPŁYWY', v: flows.map((f) => (f.from === id ? `→ ${names[f.to]}` : `← ${names[f.from]}`)).join(', ') || '—', tone: 'data' },
        ],
        body: h.role,
        impact: 'NEUTRAL',
        impactNote: 'Rosnąca premia w Azji (Szanghaj, Indie) = silny popyt fizyczny, zwykle wspiera cenę.',
        links: evs.map((e) => ({ label: `${fmtDay(e.date)} · ${e.title}`, url: e.url ?? h.url })),
        sourceUrl: h.url,
        footer: evs.length ? 'Najbliższe zdarzenia strukturalne dla tego rynku (lista powyżej).' : undefined,
      };
    }
    case 'flow': {
      const [from, to] = id.split('>');
      const f = ctx.hubs?.flows.find((x) => x.from === from && x.to === to);
      const hf = ctx.hubs?.hubs.find((x) => x.id === from);
      const ht = ctx.hubs?.hubs.find((x) => x.id === to);
      if (!f || !hf || !ht) return null;
      return {
        kind,
        tag: 'PHYSICAL FLOW',
        title: `${hf.name} → ${ht.name}`,
        subtitle: f.label,
        color: '#D4AF37',
        rows: [{ k: 'ZNACZENIE', v: '■'.repeat(f.weight) + '□'.repeat(5 - f.weight), tone: 'gold' }],
        impact: 'NEUTRAL',
        impactNote: 'Kierunki przepływów pokazują, gdzie jest popyt fizyczny. Dane: eksport/import celny (orientacyjnie).',
        sourceUrl: 'https://www.gold.org/goldhub/data/gold-trade-flows',
      };
    }
    case 'loc': {
      const [coords, name, iso] = id.split('|');
      const [lng, lat] = coords.split(',').map(Number);
      const R = Math.PI / 180;
      const sun = subsolarPoint(new Date(now));
      const elev =
        Math.asin(Math.sin(lat * R) * Math.sin(sun.lat * R) + Math.cos(lat * R) * Math.cos(sun.lat * R) * Math.cos((lng - sun.lon) * R)) / R;
      const d0 = new Date(now);
      const solarMin = (((d0.getUTCHours() * 60 + d0.getUTCMinutes() + lng * 4) % 1440) + 1440) % 1440;
      const solar = `${String(Math.floor(solarMin / 60)).padStart(2, '0')}:${String(Math.floor(solarMin % 60)).padStart(2, '0')}`;
      const here: [number, number] = [lng, lat];
      const hub = ctx.hubs?.hubs.map((h) => ({ h, d: distKm(here, [h.lon, h.lat]) })).sort((a, b) => a.d - b.d)[0];
      const choke = ctx.choke.map((c) => ({ c, d: distKm(here, [c.lon, c.lat]) })).sort((a, b) => a.d - b.d)[0];
      const ccy = name ? COUNTRY_CCY[name] : undefined;
      const bank = ccy ? ctx.banks.find((b) => b.currency === ccy) : undefined;
      const nextEv = ccy ? ctx.calendar.filter((e) => e.currency === ccy && e.time > now).slice(0, 3) : [];
      const producer = iso ? ctx.hubs?.producers.find((p) => p.iso === iso) : undefined;
      const reserve = iso ? ctx.hubs?.reserves.find((p) => p.iso === iso) : undefined;
      const regionId = name ? COUNTRY_REGION[name] : undefined;
      const region = regionId ? ctx.regions.find((r) => r.id === regionId) : undefined;
      const sanctioned = name ? SANCTIONED.includes(name) : false;
      const rows: PopupRow[] = [];
      if (reserve) rows.push({ k: 'REZERWY ZŁOTA', v: `${reserve.tonnes.toLocaleString('pl-PL')} t${reserve.trend === 'buying' ? ' · KUPUJE ▲' : reserve.trend === 'selling' ? ' · SPRZEDAJE ▼' : ''}`, tone: 'gold' });
      else if (name) rows.push({ k: 'REZERWY ZŁOTA', v: 'poza listą 34 największych', tone: 'muted' });
      if (producer) rows.push({ k: 'PRODUKCJA ZŁOTA', v: `~${producer.tonnes} t/rok`, tone: 'gold' });
      if (ccy) rows.push({ k: 'WALUTA', v: ccy, tone: 'data' });
      if (bank) {
        rows.push({ k: 'BANK CENTRALNY', v: `${bank.short} · ${bank.rateLabel}`, tone: 'gold' });
        rows.push({ k: 'KIERUNEK POLITYKI', v: STANCE_LABEL[bank.stance], tone: bank.stance === 'tightening' ? 'down' : bank.stance === 'easing' ? 'up' : 'muted' });
        if (bank.nextDecision) {
          const t = Date.parse(bank.nextDecision);
          rows.push({ k: 'NASTĘPNA DECYZJA', v: `${fmtDateTime(t)} (${fmtCountdown(t - now)})`, tone: 'warn' });
        }
      }
      if (region) rows.push({ k: 'REGION RYZYKA', v: `${region.name} · ${LEVEL_LABEL[region.level]}`, tone: region.level === 'HIGH' ? 'down' : region.level === 'ELEVATED' ? 'warn' : 'muted' });
      if (sanctioned) rows.push({ k: 'SANKCJE', v: 'szerokie sankcje USA/UE', tone: 'down' });
      if (hub) rows.push({ k: 'NAJBLIŻSZY HUB', v: `${hub.h.name} · ${Math.round(hub.d).toLocaleString('pl-PL')} km` });
      if (choke) rows.push({ k: 'NAJBLIŻSZY CHOKEPOINT', v: `${choke.c.name} · ${Math.round(choke.d).toLocaleString('pl-PL')} km` });
      return {
        kind,
        tag: name ? 'COUNTRY DOSSIER' : 'LOCATION',
        title: name || 'Ocean / brak kraju',
        subtitle: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'} · czas słoneczny ${solar} · ${elev > 0 ? 'dzień' : 'noc'}`,
        color: '#22d3ee',
        rows,
        links: nextEv.map((e) => ({ label: `${fmtDateTime(e.time)} · ${e.title}`, url: e.sourceUrl })),
        footer: nextEv.length
          ? 'Najbliższe decyzje i publikacje dla tej waluty (lista powyżej). Klik w puste miejsce zamyka kartę.'
          : 'Klik w puste miejsce zamyka kartę. Rezerwy i produkcja: przybliżenia WGC.',
      };
    }
  }
  return null;
}

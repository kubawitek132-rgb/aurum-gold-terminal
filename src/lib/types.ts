export type GoldImpact = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

/** Koperta zwracana przez każde API — warstwa wie, czy dane są świeże. */
export interface SourceResult<T> {
  data: T;
  source: string;
  updatedAt: number | null; // ms epoch ostatniego udanego pobrania
  stale: boolean;
  missing?: boolean;
  error?: string;
  /** dane zastępcze na czas pierwszego pobrania — klient dopyta szybciej */
  pending?: boolean;
}

export interface SeriesPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/* ───────── kalendarz globalny (decyzje banków + publikacje spoza USD) ───────── */
export interface CalendarEvent {
  id: string;
  title: string;
  currency: string;
  country: string;
  time: number;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
  actual: string;
  lat: number;
  lon: number;
  goldNote: string;
  goldImpact: GoldImpact;
  sourceUrl: string;
  kind?: 'cb' | 'macro';
}

/* ───────── banki centralne ───────── */
export type PolicyStance = 'tightening' | 'easing' | 'hold' | 'unknown';

export interface CentralBank {
  id: string;
  name: string;
  short: string;
  city: string;
  country: string;
  currency: string;
  lat: number;
  lon: number;
  rate: number;
  rateLabel: string;
  lastChange: { date: string; bps: number } | null;
  meetings: string[];
  lastDecision: string | null;
  nextDecision: string | null;
  stance: PolicyStance;
  goldReservesT: number | null;
  goldTrend: 'buying' | 'selling' | 'stable';
  goldNote: string;
  url: string;
  verify?: string;
  /** stopa i ostatnia zmiana pobrane automatycznie (FRED) zamiast z JSON */
  auto?: string;
}

export interface PolicyPulse {
  windowDays: number;
  hikes: { short: string; bps: number; date: string }[];
  cuts: { short: string; bps: number; date: string }[];
  holds: string[];
  unknown: string[];
  label: string;
  note: string;
  upcoming: { id: string; short: string; currency: string; time: number; rateLabel: string; stance: PolicyStance }[];
  buyers: string[];
  /** oczekiwania rynku wobec Fed (z rentowności 1Y/2Y względem EFFR) */
  fedExpect?: FedExpect | null;
}

export interface FedExpect {
  effr: number;
  y1: number;
  y2: number;
  /** pb: (1Y − EFFR) i (2Y − EFFR) */
  spread1: number;
  spread2: number;
  /** zmiana spread1 w 4 tyg., pb */
  change4w: number | null;
  label: string;
  asOf: string;
}

/* ───────── geopolityka ───────── */
export type GeoCategory = 'conflict' | 'sanctions' | 'trade' | 'diplomacy' | 'other';

export interface GeoEvent {
  id: string;
  title: string;
  url: string;
  domain: string;
  time: number;
  lat: number;
  lon: number;
  place: string;
  region: string;
  category: GeoCategory;
  impact: GoldImpact;
  approx?: boolean;
}

export type RiskLevel = 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';

export interface RegionRisk {
  id: string;
  name: string;
  lat: number;
  lon: number;
  level: RiskLevel;
  ratio: number | null; // ostatnie 3 dni / wcześniejsza średnia
  series: number[]; // dzienna intensywność (30 dni)
  dates: string[];
  gold: string;
  query: string;
}

export interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description: string;
  oilShare: string;
  status: 'NORMAL' | 'ELEVATED' | 'DISRUPTED' | 'UNKNOWN';
  mentions: number;
  headlines: { title: string; url: string; time: number }[];
  ais: { vessels: number; tankers: number; windowMin: number; updatedAt: number } | null;
  impact: GoldImpact;
}

/* ───────── rynek fizyczny ───────── */
export interface GoldHub {
  id: string;
  name: string;
  venue: string;
  lat: number;
  lon: number;
  role: string;
  premium: string | null;
  url: string;
}

export interface GoldFlow {
  from: string;
  to: string;
  label: string;
  weight: number;
}

export interface Producer {
  iso: string;
  name: string;
  tonnes: number;
}

export interface Reserve {
  iso: string;
  iso3: string;
  name: string;
  tonnes: number;
  trend: 'buying' | 'selling' | 'stable';
}

export interface HubsData {
  hubs: GoldHub[];
  flows: GoldFlow[];
  producers: Producer[];
  producersAsOf: string;
  reserves: Reserve[];
  reservesAsOf: string;
}

/* ───────── kalendarz strukturalny złota ───────── */
export interface GoldCalEvent {
  id: string;
  date: string; // YYYY-MM-DD (dzień zdarzenia, czas NY/Londyn)
  endDate?: string;
  title: string;
  category: 'comex' | 'holiday' | 'demand' | 'data' | 'cb';
  venue?: string; // id hubu
  detail: string;
  approx?: boolean;
  url?: string;
}

/* ───────── makro ───────── */
export type Effect = 'TAILWIND' | 'HEADWIND' | 'NEUTRAL';

export interface MacroFactor {
  id: string;
  label: string;
  value: number | null;
  valueLabel: string;
  changeLabel: string;
  horizon: string;
  effect: Effect;
  rule: string;
  history: number[];
  asOf: string | null;
  source: string;
  missing?: boolean;
  stale?: boolean;
}

export interface MacroData {
  factors: MacroFactor[];
  tailwinds: number;
  headwinds: number;
  neutral: number;
  summary: string;
  computedAt: number;
  stale: boolean;
  missing: boolean;
  /** część serii FRED jeszcze się pobiera */
  pending?: boolean;
  /** bilans czynników tydzień po tygodniu (rok wstecz) */
  history?: MacroHistoryPoint[];
  sentiment?: Sentiment;
}

export interface TapeItem {
  symbol: string;
  label: string;
  value: number | null;
  change: number | null; // zmiana tygodniowa (5 obs.)
  unit: '%' | 'bp' | 'idx' | 'usd' | 'bn';
  decimals: number;
  asOf: string | null;
  missing?: boolean;
  stale?: boolean;
  note?: string;
}

export interface SeasonalityData {
  months: { m: number; avg: number; median: number; positive: number; n: number }[];
  years: string;
  currentMonth: number;
}

/* ───────── diagnostyka (/api/status) ───────── */
export interface StatusSource {
  key: string;
  source: string;
  updatedAt: number | null;
  stale: boolean;
  missing: boolean;
  loading: boolean;
  error?: string;
}
export interface StatusData {
  config: { fred: boolean; twelvedataSeasonality: boolean; aisstream: boolean; telegram: boolean; redis: boolean };
  sources: StatusSource[];
  uptimeSec: number;
  serverTime: string;
}

/* ───────── tło makro: historia, sentyment ───────── */
export interface MacroHistoryPoint {
  date: string;
  tailwinds: number;
  headwinds: number;
  /** tailwinds − headwinds */
  net: number;
}
export interface Sentiment {
  vix: { value: number; change4w: number | null; asOf: string } | null;
  /** prawdopodobieństwo recesji w USA za 12 mies. (model NY Fed na spreadzie 10Y–3M), % */
  recession: { prob: number; spread: number; prob3mAgo: number | null; asOf: string } | null;
  fedExpect: FedExpect | null;
}

/* ───────── indeks ryzyka geopolitycznego GPR ───────── */
export interface GprData {
  latest: number;
  latestDate: string;
  avg30: number;
  /** średnia z ostatnich 7 dni / średnia 365 dni */
  ratio: number;
  level: RiskLevel;
  series: number[]; // ostatnie 90 dni
  dates: string[];
  events: { date: string; text: string }[];
}

/* ───────── zakupy złota przez banki centralne (IMF IRFCL) ───────── */
export interface CbGoldRow {
  iso3: string;
  name: string;
  tonnes: number;
  /** zmiana m/m w tonach */
  change1m: number | null;
  /** zmiana w 12 mies. */
  change12m: number | null;
  period: string; // np. 2026-08
  history: number[]; // ostatnie 13 mies., tony
}
export interface CbGoldData {
  rows: CbGoldRow[];
  latestPeriod: string;
  /** suma zmian m/m w ostatnim pełnym miesiącu dla krajów z danymi */
  netLastMonth: number;
  buyers: number;
  sellers: number;
}

/* ───────── reakcje złota na typy zdarzeń ───────── */
export interface ReactionStat {
  id: string;
  label: string;
  n: number;
  /** średni ruch XAU w dniu zdarzenia (zamknięcie do zamknięcia), % */
  avg0: number;
  median0: number;
  up0: number; // % przypadków ze wzrostem
  /** średni ruch od zamknięcia dnia przed zdarzeniem do 5 sesji po, % */
  avg5: number;
  last: string | null; // data ostatniego zdarzenia
  note: string;
}
export interface ReactionsData {
  stats: ReactionStat[];
  from: string;
  to: string;
  days: number;
}

/* ───────── skrót „co się zmieniło” ───────── */
export interface DigestItem {
  group: 'makro' | 'banki' | 'ryzyko' | 'chokepointy' | 'złoto';
  tone: 'up' | 'down' | 'warn' | 'muted';
  text: string;
}
export interface DigestData {
  generatedAt: number;
  headline: string;
  items: DigestItem[];
  upcoming: { date: string; text: string; kind: 'cb' | 'gold' }[];
  /** porównanie z czym (np. poprzedni odczyt / wczoraj) */
  basis: string;
}

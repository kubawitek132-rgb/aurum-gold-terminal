export type LayerId = 'daynight' | 'banks' | 'calendar' | 'risk' | 'geo' | 'choke' | 'hubs' | 'reserves';

export interface LayerDef {
  id: LayerId;
  label: string;
  short: string;
  icon: string;
  color: string;
  defaultOn: boolean;
}

export const LAYERS: LayerDef[] = [
  { id: 'banks', label: 'BANKI CENTRALNE', short: 'CB', icon: '⌂', color: '#D4AF37', defaultOn: true },
  { id: 'calendar', label: 'DECYZJE I PUBLIKACJE', short: 'CAL', icon: '◷', color: '#f59e0b', defaultOn: true },
  { id: 'risk', label: 'RYZYKO REGIONÓW', short: 'RSK', icon: '◎', color: '#f43f5e', defaultOn: true },
  { id: 'geo', label: 'ZDARZENIA GEO 24H', short: 'GEO', icon: '⚠', color: '#ef4444', defaultOn: true },
  { id: 'choke', label: 'CHOKEPOINTY', short: 'CHK', icon: '⧖', color: '#fb923c', defaultOn: true },
  { id: 'hubs', label: 'RYNEK FIZYCZNY', short: 'AU', icon: '◆', color: '#D4AF37', defaultOn: true },
  { id: 'reserves', label: 'REZERWY ZŁOTA', short: 'RES', icon: '▣', color: '#facc15', defaultOn: false },
  { id: 'daynight', label: 'DZIEŃ / NOC', short: 'D/N', icon: '◐', color: '#a78bfa', defaultOn: true },
];

/** Warstwy MapLibre należące do każdej warstwy logicznej. */
export const MAP_LAYER_IDS: Record<LayerId, string[]> = {
  daynight: ['night'],
  banks: ['banks-halo', 'banks-pts'],
  calendar: ['cal-halo', 'cal-pts'],
  risk: ['risk-halo', 'risk-pts'],
  geo: ['geo-heat', 'geo-pts'],
  choke: ['choke-halo', 'choke-pts'],
  hubs: ['countries-fill', 'countries-line', 'hubs-pts'],
  reserves: ['res-fill', 'res-line'],
};

export const INTERACTIVE_LAYERS = ['banks-pts', 'cal-pts', 'risk-pts', 'geo-pts', 'choke-pts', 'hubs-pts'];

export const IMPACT_COLOR = {
  BULLISH: '#22c55e',
  BEARISH: '#ef4444',
  NEUTRAL: '#94a3b8',
} as const;

export const STANCE_COLOR = {
  tightening: '#ef4444',
  easing: '#22c55e',
  hold: '#94a3b8',
  unknown: '#64748b',
} as const;

export const STANCE_LABEL = {
  tightening: 'ZACIEŚNIANIE',
  easing: 'LUZOWANIE',
  hold: 'PAUZA',
  unknown: 'BRAK DANYCH',
} as const;

export const LEVEL_COLOR = {
  LOW: '#22c55e',
  NORMAL: '#94a3b8',
  ELEVATED: '#f59e0b',
  HIGH: '#ef4444',
  UNKNOWN: '#475569',
} as const;

export const LEVEL_LABEL = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  UNKNOWN: 'BRAK DANYCH',
} as const;

export const CHOKE_COLOR = {
  NORMAL: '#22c55e',
  ELEVATED: '#f59e0b',
  DISRUPTED: '#ef4444',
  UNKNOWN: '#475569',
} as const;

export const EFFECT_COLOR = {
  TAILWIND: '#22c55e',
  HEADWIND: '#ef4444',
  NEUTRAL: '#94a3b8',
} as const;

export const EFFECT_LABEL = {
  TAILWIND: 'SPRZYJA',
  HEADWIND: 'SZKODZI',
  NEUTRAL: 'NEUTRALNIE',
} as const;

export const CAT_COLOR = {
  comex: '#22d3ee',
  holiday: '#a78bfa',
  demand: '#D4AF37',
  data: '#94a3b8',
  cb: '#f59e0b',
} as const;

export const CAT_LABEL = {
  comex: 'COMEX',
  holiday: 'ŚWIĘTO',
  demand: 'POPYT',
  data: 'DANE',
  cb: 'BANK',
} as const;

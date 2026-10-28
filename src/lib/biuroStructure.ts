/** Public role names only. No operational payloads, accounts or private endpoints. */
export type InventorySourceStatus = 'verified' | 'configured' | 'unknown';
export type StationInstallation = 'installed' | 'configured' | 'unknown';
export type BiuroFloorId = 'aurum' | 'coin' | 'hq';

export interface BiuroStation {
  id: string;
  name: string;
  role?: string;
  installation: StationInstallation;
  sourceId: string;
}

export interface BiuroDepartment {
  id: string;
  name: string;
  kind: 'office-section' | 'operational-department' | 'interface-roster';
  stations: readonly BiuroStation[];
}

export interface BiuroFloorInventory {
  id: BiuroFloorId;
  name: string;
  number: string;
  departments: readonly BiuroDepartment[];
  sourceLabel: string;
  sourceStatus: InventorySourceStatus;
  verifiedAt?: string;
  notes: readonly string[];
  counts: {
    stations: number | null;
    groups: number | null;
    officeSections: number;
    operationalDepartments: number;
  };
}

const VERIFIED_AT = '2026-10-28T09:30:19Z';
const AURUM_SOURCE = 'aurum-installed-v23';

function agents(id: string, name: string, rows: readonly (readonly [string, string, string])[]): BiuroDepartment {
  return { id: `aurum-office-${id}`, name, kind: 'office-section', stations: rows.map(([stationId, person, role]) => ({
    id: `aurum-agent-${stationId}`, name: person, role, installation: 'installed', sourceId: AURUM_SOURCE,
  })) };
}

function operations(id: string, name: string, rows: readonly (readonly [string, string])[]): BiuroDepartment {
  return { id: `aurum-ops-${id}`, name, kind: 'operational-department', stations: rows.map(([stationId, role]) => ({
    id: `aurum-position-${stationId}`, name: role, installation: 'installed', sourceId: AURUM_SOURCE,
  })) };
}

const AURUM_DEPARTMENTS: readonly BiuroDepartment[] = [
  agents('research', 'Research', [['news', 'BOLO', 'News'], ['macro', 'TARAS', 'Macro'], ['structure', 'VLADEK', 'Structure & Flow']]),
  agents('trading', 'Trading', [['strategy', 'BORAT', 'Strategist'], ['risk', 'IGOR', 'Risk Desk'], ['execution', 'VIKTOR', 'Executor']]),
  agents('operations', 'Operations', [['audit', 'ROMAN', 'Auditor'], ['ops', 'BRUNO', 'OPS Engineer'], ['continuity', 'JURI', 'Continuity']]),
  agents('assurance', 'Assurance', [['qa', 'MISZA', 'QA Engineer'], ['release', 'KOSTIA', 'Release Manager'], ['data', 'DIMITRI', 'Data Steward']]),
  agents('laboratory', 'Laboratorium strategii', [['strategy_research', 'SASZA', 'Strategy Research']]),
  agents('analysis', 'Analiza interwałów', [
    ['tf_m1', 'ZENEK', 'M1 Analyst'], ['tf_m2', 'WITEK', 'M2 Analyst'], ['tf_m5', 'OLEG', 'M5 Analyst'],
    ['tf_m15', 'SERGEJ', 'M15 Analyst'], ['tf_m30', 'LEON', 'M30 Analyst'], ['tf_h1', 'GRISZA', 'H1 Analyst'], ['tf_h4', 'STASZEK', 'H4 Analyst'],
  ]),
  operations('ai-costs', 'Darmowe AI i koszty', [
    ['keys_watch', 'Strażnik kluczy i dostępów'], ['ai_ledger', 'Księgowy limitów AI'], ['ai_efficiency', 'Optymalizacja operacyjna (efektywność AI)'],
  ]),
  operations('operations', 'Operacje', [
    ['oncall', 'Dyżurny i eskalacja'], ['restore_verify', 'Tester odtworzenia kopii'], ['janitor', 'Runbooki i porządki'],
    ['decide', 'Warstwa decyzyjna biura (AI proponuje, polityka decyduje)'], ['organizacja', 'Organizacja biura (architekt stanowisk)'],
    ['learning', 'Rozwój biura (pętla uczenia)'], ['wiedza', 'Baza wiedzy biura (podręcznik, indeks i wyszukiwanie)'], ['backlog', 'Backlog biura (realizacja automatyczna)'],
  ]),
  operations('audit', 'Audyt', [['compliance', 'Tester zgodności (tylko AU FLOW składa zlecenia)']]),
  operations('data', 'Dane', [['data_sources', 'Źródła danych (BLS zapas, M1/M2/M5)']]),
  operations('innovation', 'Innowacje', [['intake', 'Przyjmowanie rekomendacji (Darmowe AI, Innowacje)']]),
  operations('reporting', 'Raportowanie', [['weekly_digest', 'Digest tygodniowy']]),
  operations('releases', 'Wydania', [['release_engineer', 'Release Engineer AURUM']]),
  operations('data-sources', 'Źródła danych', [['office_bars', 'Most świec M1/M2/M5 (Twelve Data → biuro)']]),
  operations('dev-api', 'API i integracje', [
    ['dev_api_1', 'Architekt API'], ['dev_api_2', 'Inżynier API i integracji'], ['dev_api_3', 'Tester kontraktów i operator API'],
  ]),
  operations('dev-cloud', 'Chmura AURUM', [
    ['dev_cloud_1', 'Architekt chmury'], ['dev_cloud_2', 'Inżynier magazynu i synchronizacji'], ['dev_cloud_3', 'Tester odtwarzania i operator chmury'],
  ]),
  operations('dev-ai', 'Wspólne AI AURUM', [
    ['dev_ai_1', 'Architekt wspólnego AI'], ['dev_ai_2', 'Inżynier routera i pamięci AI'], ['dev_ai_3', 'Tester jakości, kosztów i lokalnego AI'],
  ]),
  operations('dev-engineering', 'Inżynieria i wdrożenia', [
    ['dev_engineering_1', 'Inżynier budowy pakietów'], ['dev_engineering_2', 'Tester regresji i integracji'], ['dev_engineering_3', 'Operator wydań i wycofania'],
  ]),
  operations('dev-data', 'Dane i wiedza', [
    ['dev_data_1', 'Architekt danych i wiedzy'], ['dev_data_2', 'Inżynier katalogu i eksportu'], ['dev_data_3', 'Tester jakości i przenośności'],
  ]),
  operations('dev-continuity', 'Niezależność i ciągłość', [
    ['dev_continuity_1', 'Architekt niezależności'], ['dev_continuity_2', 'Inżynier ciągłości i migracji'], ['dev_continuity_3', 'Tester awarii i operator niezawodności'],
  ]),
  operations('current-bot', 'Rozwój obecnego bota', [
    ['trading_review', 'Analityk wyników bota'], ['trading_repairs', 'Inżynier poprawek bota'], ['trading_risk', 'Zarządzający ryzykiem DEMO'],
  ]),
  operations('new-bots', 'Nowe boty', [
    ['newbots_builder', 'Konstruktor nowych botów'], ['newbots_tester', 'Tester porównawczy botów'], ['newbots_release', 'Operator kwalifikacji botów'],
  ]),
];

const COIN_ROLE_NAMES = ['Szef', 'Szukacz', 'Liczby', 'Audyt', 'Projekt', 'Twarz', 'Ryzyko', 'Wyjście', 'Egzekucja', 'Straż', 'Raport', 'Warsztat'] as const;

/** Bottom-to-top architectural order; an unknown roster never becomes zero staff. */
export const BIURO_FLOORS: readonly BiuroFloorInventory[] = [
  {
    id: 'aurum', number: '01', name: 'AURUM', departments: AURUM_DEPARTMENTS,
    sourceLabel: 'CHMURA · zainstalowane AURUM Office v23 + rejestr Sentinel', sourceStatus: 'verified', verifiedAt: VERIFIED_AT,
    counts: { stations: 61, groups: 22, officeSections: 6, operationalDepartments: 16 },
    notes: [
      '20 nazwanych ról biura w 6 sekcjach oraz 41 stanowisk rejestru Sentinel w 16 działach operacyjnych.',
      '22 grupy pochodzą z dwóch rejestrów. Sekcje biura i działy operacyjne zachowują własne nazwy; nie są deklaracją 22 niezależnych zespołów.',
      'Research i laboratorium SASZY należą do AURUM; nie są osobnym piętrem ani dodatkową ekipą.',
      'Liczby potwierdzają zainstalowane definicje stanowisk. Nie potwierdzają bieżącej pracy, dostępności modeli ani kwalifikacji każdej funkcji.',
      'FIEDIA występuje w starszym kandydacie przygotowanym do wdrożenia, lecz nie w bieżącym core.py v23; nie jest doliczany.',
    ],
  },
  {
    id: 'coin', number: '02', name: 'Coin Bot',
    departments: [{ id: 'coin-interface-roster', name: 'Role Coin Bota', kind: 'interface-roster', stations: COIN_ROLE_NAMES.map((name, index) => ({
      id: `coin-role-${index + 1}`, name, installation: 'configured', sourceId: 'coin-current-interface',
    })) }],
    sourceLabel: 'Bieżący interfejs biura Coin Bota · 12 nagłówków ról', sourceStatus: 'verified', verifiedAt: VERIFIED_AT,
    counts: { stations: 12, groups: 1, officeSections: 0, operationalDepartments: 0 },
    notes: [
      '12 ról odczytanych z istniejącego interfejsu. Źródło nie deklaruje przypisania do osobnych działów.',
      'Jedna grupa w tym modelu oznacza jeden źródłowy wykaz ról, a nie dodatkowy dział firmy.',
      'Odczyt interfejsu potwierdza nazwy ról, nie stan uruchomienia każdej roli ani uprawnienia do zleceń.',
    ],
  },
  {
    id: 'hq', number: '03', name: 'Biuro HQ', departments: [], sourceLabel: 'Brak potwierdzonego odrębnego rejestru HQ', sourceStatus: 'unknown',
    counts: { stations: null, groups: null, officeSections: 0, operationalDepartments: 0 },
    notes: ['Odrębna liczba działów i stanowisk HQ nie została potwierdzona. Nie przenosimy tu ról AURUM ani Coin Bota i nie dodajemy fikcyjnych stanowisk.'],
  },
];

export const BIURO_STRUCTURE = {
  version: 1,
  verifiedAt: VERIFIED_AT,
  floors: BIURO_FLOORS,
  sources: [
    { id: AURUM_SOURCE, label: 'CHMURA · AURUM Office', release: 'aurum-office-20261027-v23', status: 'installed' as const,
      evidence: 'Bieżący manifest: zgodne hashe core.py i static/scene.js; odczyt oryginalnego rejestru stanowisk Sentinel.', verifiedAt: VERIFIED_AT },
    { id: 'coin-current-interface', label: 'Coin Bot · wykaz ról w istniejącym biurze', status: 'configured' as const,
      evidence: '12 nagłówków ról w bieżącym interfejsie biura; brak danych portfela w tym wykazie.', verifiedAt: VERIFIED_AT },
  ],
} as const;

export function getFloorInventory(id: string): BiuroFloorInventory | undefined {
  return BIURO_FLOORS.find(floor => floor.id === id);
}

export function summarizeInventory(floors: readonly BiuroFloorInventory[] = BIURO_FLOORS) {
  const stations = floors.flatMap(floor => floor.departments.flatMap(department => department.stations));
  return {
    knownStations: stations.length,
    installedStations: stations.filter(station => station.installation === 'installed').length,
    configuredStations: stations.filter(station => station.installation === 'configured').length,
    unknownFloors: floors.filter(floor => floor.sourceStatus === 'unknown').length,
    complete: floors.every(floor => floor.counts.stations !== null),
  };
}

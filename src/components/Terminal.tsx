'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePoll } from '@/hooks/usePoll';
import { useNow } from '@/hooks/useNow';
import { LAYERS, type LayerId } from '@/lib/layers';
import { banksFC, calendarFC, chokeFC, geoFC, hubsFC, riskFC } from '@/lib/features';
import { buildPopup } from '@/lib/popups';
import type {
  CalendarEvent,
  CentralBank,
  Chokepoint,
  GeoEvent,
  GoldCalEvent,
  HubsData,
  MacroData,
  PolicyPulse,
  RegionRisk,
  SeasonalityData,
  SourceResult,
  StatusData,
  TapeItem,
  DigestData,
  GprData,
  CbGoldData,
  ReactionsData,
} from '@/lib/types';
import TopBar from './TopBar';
import MacroTape from './MacroTape';
import LayerBar, { type LayerMeta } from './LayerBar';
import RightPanel from './RightPanel';
import MapPopup from './MapPopup';
import Legend from './Legend';
import { ErrorBoundary } from './ui';
import type { FlowDatum, Selection } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

const MIN = 60_000;
const PREFS_KEY = 'aurum:prefs:v2';

interface Prefs {
  layers?: Partial<Record<LayerId, boolean>>;
  projection?: 'globe' | 'mercator';
  basemap?: 'map' | 'sat';
  calRange?: 168 | 720;
  legend?: boolean;
}

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

export default function Terminal() {
  const now = useNow(1000);

  /* ── dane ── */
  const macro = usePoll<{ macro: MacroData; tape: TapeItem[] }>('/api/macro', 30 * MIN);
  const calendar = usePoll<SourceResult<CalendarEvent[]>>('/api/calendar', 10 * MIN);
  const banks = usePoll<SourceResult<CentralBank[]>>('/api/banks', 30 * MIN);
  const pulse = usePoll<SourceResult<PolicyPulse>>('/api/policy', 30 * MIN);
  const geo = usePoll<SourceResult<GeoEvent[]>>('/api/geo', 10 * MIN);
  const regions = usePoll<SourceResult<RegionRisk[]>>('/api/regions', 30 * MIN);
  const choke = usePoll<SourceResult<Chokepoint[]>>('/api/chokepoints', 15 * MIN);
  const hubs = usePoll<SourceResult<HubsData>>('/api/hubs', 120 * MIN);
  const goldcal = usePoll<SourceResult<GoldCalEvent[]>>('/api/goldcal?days=75', 60 * MIN);
  const season = usePoll<SourceResult<SeasonalityData | null>>('/api/seasonality', 6 * 60 * MIN);
  const status = usePoll<StatusData>('/api/status', 2 * MIN);
  const digest = usePoll<DigestData>('/api/digest', 15 * MIN);
  const gpr = usePoll<SourceResult<GprData | null>>('/api/gpr', 60 * MIN);
  const cbgold = usePoll<SourceResult<CbGoldData | null>>('/api/cbgold', 6 * 60 * MIN);
  const reactions = usePoll<SourceResult<ReactionsData | null>>('/api/reactions', 6 * 60 * MIN);

  /* ── stan UI (zapamiętywany w przeglądarce) ── */
  const [prefs] = useState<Prefs>(loadPrefs);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(
    () => Object.fromEntries(LAYERS.map((l) => [l.id, prefs.layers?.[l.id] ?? l.defaultOn])) as Record<LayerId, boolean>,
  );
  const [projection, setProjection] = useState<'globe' | 'mercator'>(prefs.projection ?? 'globe');
  const [basemap, setBasemap] = useState<'map' | 'sat'>(prefs.basemap ?? 'map');
  const [calRange, setCalRange] = useState<168 | 720>(prefs.calRange ?? 720);
  const [legend, setLegend] = useState<boolean>(prefs.legend ?? false);
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ layers, projection, basemap, calRange, legend }));
    } catch {
      /* storage niedostępny — ignorujemy */
    }
  }, [layers, projection, basemap, calRange, legend]);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [flyTo, setFlyTo] = useState<{ lngLat: [number, number]; zoom?: number; key: number } | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const toggle = useCallback((id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] })), []);
  const closeSel = useCallback(() => setSelection(null), []);

  /* ── skróty klawiszowe: Esc, 1–8 warstwy, G 3D/2D, S satelita, L legenda ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') {
        setSelection(null);
        setLeftOpen(false);
        setRightOpen(false);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= LAYERS.length) return toggle(LAYERS[n - 1].id);
      const k = e.key.toLowerCase();
      if (k === 'g') setProjection((p) => (p === 'globe' ? 'mercator' : 'globe'));
      else if (k === 's') setBasemap((b) => (b === 'map' ? 'sat' : 'map'));
      else if (k === 'l') setLegend((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  /* ── GeoJSON dla mapy ── */
  const minute = Math.floor(now / MIN);
  const mapData = useMemo(
    () => ({
      calendar: calendarFC(calendar.data?.data ?? [], minute * MIN, calRange),
      banks: banksFC(banks.data?.data ?? []),
      risk: riskFC(regions.data?.data ?? []),
      geo: geoFC(geo.data?.data ?? []),
      choke: chokeFC(choke.data?.data ?? []),
      hubs: hubsFC(hubs.data?.data.hubs ?? []),
    }),
    [minute, calendar.data, calRange, banks.data, regions.data, geo.data, choke.data, hubs.data],
  );

  const flows = useMemo<FlowDatum[]>(() => {
    const h = hubs.data?.data;
    if (!h) return [];
    const pos = new Map(h.hubs.map((x) => [x.id, [x.lon, x.lat] as [number, number]]));
    return h.flows
      .filter((f) => pos.has(f.from) && pos.has(f.to))
      .map((f, i) => ({ id: `${f.from}>${f.to}`, from: pos.get(f.from)!, to: pos.get(f.to)!, weight: f.weight, phase: (i * 0.37) % 1 }));
  }, [hubs.data]);

  const producers = useMemo(
    () => Object.fromEntries((hubs.data?.data.producers ?? []).map((p) => [p.iso, p.tonnes])) as Record<string, number>,
    [hubs.data],
  );
  const reserves = useMemo(
    () => Object.fromEntries((hubs.data?.data.reserves ?? []).map((p) => [p.iso, p.tonnes])) as Record<string, number>,
    [hubs.data],
  );

  /* ── liczniki warstw ── */
  const meta: Record<LayerId, LayerMeta> = useMemo(() => {
    const m = <T,>(r: SourceResult<T> | null) => ({ stale: r?.stale, missing: r?.missing, updatedAt: r?.updatedAt, source: r?.source });
    const chokeAlert = (choke.data?.data ?? []).filter((c) => c.status === 'ELEVATED' || c.status === 'DISRUPTED').length;
    const riskAlert = (regions.data?.data ?? []).filter((r) => r.level === 'HIGH').length;
    return {
      daynight: { count: 1, source: 'obliczenia lokalne' },
      banks: { count: banks.data?.data.length ?? 0, ...m(banks.data) },
      calendar: { count: mapData.calendar.features.length, ...m(calendar.data) },
      risk: { count: regions.data?.data.length ?? 0, alert: riskAlert, ...m(regions.data) },
      geo: { count: geo.data?.data.length ?? 0, ...m(geo.data) },
      choke: { count: choke.data?.data.length ?? 0, alert: chokeAlert, ...m(choke.data) },
      hubs: { count: (hubs.data?.data.hubs.length ?? 0) + flows.length, ...m(hubs.data) },
      reserves: { count: hubs.data?.data.reserves.length ?? 0, source: hubs.data?.data.reservesAsOf },
    };
  }, [mapData, calendar.data, banks.data, regions.data, geo.data, choke.data, hubs.data, flows.length]);

  /* ── popup ── */
  const popup = useMemo(() => {
    if (!selection) return null;
    return buildPopup(selection.kind, selection.id, {
      now,
      banks: banks.data?.data ?? [],
      calendar: calendar.data?.data ?? [],
      geo: geo.data?.data ?? [],
      regions: regions.data?.data ?? [],
      choke: choke.data?.data ?? [],
      hubs: hubs.data?.data ?? null,
      goldcal: goldcal.data?.data ?? [],
      tape: macro.data?.tape ?? [],
    });
  }, [selection, now, banks.data, calendar.data, geo.data, regions.data, choke.data, hubs.data, goldcal.data, macro.data]);

  const focus = useCallback((kind: string, id: string, lngLat: [number, number], layer: LayerId, zoom = 2.6) => {
    setLayers((l) => ({ ...l, [layer]: true }));
    setSelection({ kind, id, lngLat });
    setFlyTo({ lngLat, zoom, key: Date.now() });
    setRightOpen(false);
  }, []);

  const pickBank = useCallback(
    (id: string) => {
      const b = banks.data?.data.find((x) => x.id === id);
      if (b) focus('bank', b.id, [b.lon, b.lat], 'banks');
    },
    [banks.data, focus],
  );
  const pickRegion = useCallback((r: RegionRisk) => focus('risk', r.id, [r.lon, r.lat], 'risk', 2.2), [focus]);
  const pickGoldEvent = useCallback(
    (e: GoldCalEvent) => {
      const h = e.venue ? hubs.data?.data.hubs.find((x) => x.id === e.venue) : undefined;
      if (h) focus('hub', h.id, [h.lon, h.lat], 'hubs', 3);
    },
    [hubs.data, focus],
  );

  // marker kalendarza może być rozsunięty — dopasuj popup do faktycznego punktu
  const effectiveSelection = useMemo(() => {
    if (!selection || selection.kind !== 'cal') return selection;
    const f = mapData.calendar.features.find((x) => x.properties?.id === selection.id);
    return f ? { ...selection, lngLat: f.geometry.coordinates as [number, number] } : selection;
  }, [selection, mapData.calendar]);

  const all = [macro.data?.macro, calendar.data, geo.data, regions.data, choke.data] as ({ missing?: boolean; stale?: boolean; pending?: boolean } | undefined)[];
  const dataStatus: 'OK' | 'PARTIAL' | 'STALE' | 'OFFLINE' | 'LOADING' =
    macro.error && !macro.data
      ? 'OFFLINE'
      : !macro.data || all.some((x) => x?.pending)
        ? 'LOADING'
        : all.some((x) => x?.missing)
          ? 'PARTIAL'
          : all.some((x) => x?.stale)
            ? 'STALE'
            : 'OK';
  const popupEl = useMemo(() => (popup ? <MapPopup p={popup} onClose={closeSel} /> : null), [popup, closeSel]);
  const nextGoldEvent = (goldcal.data?.data ?? []).find((e) => e.category !== 'cb' && e.date >= new Date(now).toISOString().slice(0, 10)) ?? null;

  const layerBarProps = { layers, meta, onToggle: toggle, calRange, onCalRange: setCalRange, now };
  const rightProps = {
    now,
    macro: macro.data?.macro ?? null,
    pulse: pulse.data,
    regions: regions.data,
    goldcal: goldcal.data,
    season: season.data,
    hubs: hubs.data?.data ?? null,
    status: status.data,
    digest: digest.data,
    gpr: gpr.data,
    cbgold: cbgold.data,
    reactions: reactions.data,
    onPickBank: pickBank,
    onPickRegion: pickRegion,
    onPickGoldEvent: pickGoldEvent,
    onShowReserves: () => {
      setLayers((l) => ({ ...l, reserves: true, hubs: false }));
      setRightOpen(false);
    },
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg font-mono text-slate-200">
      <TopBar
        now={now}
        macro={macro.data?.macro ?? null}
        pulse={pulse.data?.data ?? null}
        nextEvent={nextGoldEvent}
        dataStatus={dataStatus}
        activeLayers={Object.values(layers).filter(Boolean).length}
        totalLayers={LAYERS.length}
        onMenu={() => setLeftOpen(true)}
        onPanels={() => setRightOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden shrink-0 border-r border-line bg-panel/90 md:block">
          <LayerBar {...layerBarProps} />
        </aside>

        <main className="grid-bg relative min-w-0 flex-1">
          <ErrorBoundary label="MAPA">
          <MapView
            layers={layers}
            projection={projection}
            basemap={basemap}
            data={mapData}
            flows={flows}
            producers={producers}
            reserves={reserves}
            selection={effectiveSelection}
            onSelect={setSelection}
            flyTo={flyTo}
          >
            {popupEl}
          </MapView>
          </ErrorBoundary>

          <div className="absolute left-2 top-2 z-10 flex gap-1 text-[10px] font-bold tracking-[0.2em]">
            {(['globe', 'mercator'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProjection(p)}
                className={`border px-2 py-1 backdrop-blur ${projection === p ? 'border-data bg-data/10 text-data' : 'border-line bg-panel/70 text-muted'}`}
              >
                {p === 'globe' ? '3D' : '2D'}
              </button>
            ))}
            <span className="w-1" />
            {(['map', 'sat'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className={`border px-2 py-1 backdrop-blur ${basemap === b ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-panel/70 text-muted'}`}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="pointer-events-none absolute right-2 top-2 z-10 hidden flex-col items-end gap-0.5 text-[9px] tracking-wider sm:flex">
            {LAYERS.filter((l) => layers[l.id]).map((l) => (
              <span key={l.id} className="bg-panel/70 px-1.5 py-0.5" style={{ color: l.color }}>
                {l.icon} {l.label} · {meta[l.id].count}
                {(meta[l.id].stale || meta[l.id].missing) && <span className="ml-1 text-warn">{meta[l.id].missing ? 'BRAK DANYCH' : 'STALE'}</span>}
              </span>
            ))}
          </div>

          {!(selection && typeof window !== 'undefined' && window.innerWidth < 640) && <Legend open={legend} onToggle={() => setLegend((v) => !v)} />}
        </main>

        <aside className="hidden w-[350px] shrink-0 border-l border-line bg-panel/95 lg:block">
          <ErrorBoundary label="PANELE">
            <RightPanel {...rightProps} />
          </ErrorBoundary>
        </aside>

        {leftOpen && (
          <div className="absolute inset-0 z-40 flex md:hidden" onClick={() => setLeftOpen(false)}>
            <div className="h-full w-[280px] overflow-y-auto border-r border-line bg-panel" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] tracking-[0.2em] text-data">
                WARSTWY
                <button onClick={() => setLeftOpen(false)} className="text-muted">
                  [X]
                </button>
              </div>
              <LayerBar {...layerBarProps} expanded />
            </div>
            <div className="flex-1 bg-black/50" />
          </div>
        )}
        {rightOpen && (
          <div className="absolute inset-0 z-40 flex justify-end lg:hidden" onClick={() => setRightOpen(false)}>
            <div className="h-full w-[min(370px,92vw)] border-l border-line bg-panel" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] tracking-[0.2em] text-data">
                PANELE
                <button onClick={() => setRightOpen(false)} className="text-muted">
                  [X]
                </button>
              </div>
              <div className="h-[calc(100%-37px)]">
                <RightPanel {...rightProps} />
              </div>
            </div>
          </div>
        )}
      </div>

      <MacroTape items={macro.data?.tape ?? []} />
    </div>
  );
}

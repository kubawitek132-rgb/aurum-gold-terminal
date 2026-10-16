'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Map as MLMap, NavigationControl, type GeoJSONSource, type IControl, type PointLike, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, PathLayer } from '@deck.gl/layers';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import countries110 from 'world-atlas/countries-110m.json';
import { graticule, greatCirclePoint, nightPolygon } from '@/lib/geo';
import { INTERACTIVE_LAYERS, MAP_LAYER_IDS, type LayerId } from '@/lib/layers';

export interface FlowDatum {
  id: string;
  from: [number, number];
  to: [number, number];
  weight: number;
  phase: number;
}

export interface Selection {
  kind: string;
  id: string;
  lngLat: [number, number];
}

interface Props {
  layers: Record<LayerId, boolean>;
  projection: 'globe' | 'mercator';
  basemap: 'map' | 'sat';
  data: Record<string, FeatureCollection>;
  flows: FlowDatum[];
  producers: Record<string, number>;
  reserves: Record<string, number>;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  flyTo: { lngLat: [number, number]; zoom?: number; key: number } | null;
  children?: ReactNode; // treść popupu
}

const SOURCE_IDS = ['calendar', 'banks', 'risk', 'geo', 'choke', 'hubs'] as const;

function buildStyle(): StyleSpecification {
  const carto = (kind: string) => ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/${kind}/{z}/{x}/{y}@2x.png`);
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#05070a',
      'horizon-color': '#0d2236',
      'fog-color': '#05070a',
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      carto: { type: 'raster', tiles: carto('dark_nolabels'), tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO' },
      cartoLabels: { type: 'raster', tiles: carto('dark_only_labels'), tileSize: 256 },
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#03050a' } },
      { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.95, 'raster-saturation': -0.4 } },
      { id: 'esri', type: 'raster', source: 'esri', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.8 } },
      { id: 'carto-labels', type: 'raster', source: 'cartoLabels', paint: { 'raster-opacity': 0.55 } },
    ],
  };
}

const countriesFC = (() => {
  const topo = countries110 as unknown as Parameters<typeof feature>[0] & { objects: { countries: Parameters<typeof feature>[1] } };
  return feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name?: string }>;
})();

function addLayers(map: MLMap) {
  map.addSource('graticule', { type: 'geojson', data: graticule(30) });
  map.addSource('night', { type: 'geojson', data: nightPolygon(new Date()) });
  map.addSource('countries', { type: 'geojson', data: countriesFC, promoteId: undefined });
  for (const id of SOURCE_IDS) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({
    id: 'graticule',
    type: 'line',
    source: 'graticule',
    paint: {
      'line-color': ['match', ['get', 'kind'], 'equator', '#1f4d6e', '#14263a'],
      'line-width': ['match', ['get', 'kind'], 'equator', 1, 0.6],
      'line-opacity': 0.8,
    },
  });
  // niewidoczna warstwa do rozpoznawania kraju pod kursorem (popup „LOCATION” dla dowolnego punktu)
  map.addLayer({ id: 'countries-hit', type: 'fill', source: 'countries', paint: { 'fill-color': 'rgba(0,0,0,0.01)' } });
  map.addLayer({
    id: 'countries-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'tonnes'], 0],
        0,
        'rgba(0,0,0,0)',
        1,
        'rgba(212,175,55,0.10)',
        150,
        'rgba(212,175,55,0.28)',
        400,
        'rgba(212,175,55,0.55)',
      ],
    },
  });
  map.addLayer({
    id: 'countries-line',
    type: 'line',
    source: 'countries',
    paint: {
      'line-color': ['case', ['>', ['coalesce', ['get', 'tonnes'], 0], 0], 'rgba(212,175,55,0.55)', 'rgba(0,0,0,0)'],
      'line-width': 0.7,
    },
  });
  map.addLayer({
    id: 'res-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'reserves'], 0],
        0,
        'rgba(0,0,0,0)',
        1,
        'rgba(250,204,21,0.10)',
        500,
        'rgba(250,204,21,0.30)',
        2000,
        'rgba(250,204,21,0.50)',
        8000,
        'rgba(250,204,21,0.70)',
      ],
    },
  });
  map.addLayer({
    id: 'res-line',
    type: 'line',
    source: 'countries',
    paint: {
      'line-color': ['case', ['>', ['coalesce', ['get', 'reserves'], 0], 0], 'rgba(250,204,21,0.6)', 'rgba(0,0,0,0)'],
      'line-width': 0.8,
    },
  });
  map.addLayer({ id: 'night', type: 'fill', source: 'night', paint: { 'fill-color': '#000611', 'fill-opacity': 0.42 } });
  map.addLayer({
    id: 'geo-heat',
    type: 'heatmap',
    source: 'geo',
    paint: {
      'heatmap-weight': ['coalesce', ['get', 'w'], 0.5],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 6, 2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 16, 4, 30, 8, 50],
      'heatmap-opacity': 0.7,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(0,0,0,0)',
        0.2,
        'rgba(127,29,29,0.5)',
        0.45,
        'rgba(220,38,38,0.7)',
        0.7,
        'rgba(249,115,22,0.85)',
        1,
        'rgba(250,204,21,0.95)',
      ],
    },
  });
  map.addLayer({
    id: 'risk-halo',
    type: 'circle',
    source: 'risk',
    paint: {
      'circle-radius': ['get', 'r'],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.12,
      'circle-blur': 0.5,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.5,
    },
  });
  map.addLayer({
    id: 'risk-pts',
    type: 'circle',
    source: 'risk',
    paint: { 'circle-radius': 6, 'circle-color': '#05070a', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 },
  });
  map.addLayer({
    id: 'hubs-pts',
    type: 'circle',
    source: 'hubs',
    paint: {
      'circle-radius': 6,
      'circle-color': '#D4AF37',
      'circle-stroke-color': '#fff3c4',
      'circle-stroke-width': 1.2,
    },
  });
  map.addLayer({
    id: 'banks-halo',
    type: 'circle',
    source: 'banks',
    paint: {
      'circle-radius': ['+', ['get', 'r'], 5],
      'circle-color': 'rgba(212,175,55,0.08)',
      'circle-stroke-color': ['get', 'ring'],
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.7,
    },
  });
  map.addLayer({
    id: 'banks-pts',
    type: 'circle',
    source: 'banks',
    paint: {
      'circle-radius': ['*', ['get', 'r'], 0.6],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#05070a',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'choke-halo',
    type: 'circle',
    source: 'choke',
    filter: ['==', ['get', 'alert'], 1],
    paint: { 'circle-radius': 12, 'circle-opacity': 0, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.6 },
  });
  map.addLayer({
    id: 'choke-pts',
    type: 'circle',
    source: 'choke',
    paint: { 'circle-radius': 5.5, 'circle-color': '#05070a', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5 },
  });
  map.addLayer({
    id: 'cal-halo',
    type: 'circle',
    source: 'calendar',
    paint: { 'circle-radius': ['get', 'r'], 'circle-opacity': 0, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.5 },
  });
  map.addLayer({
    id: 'cal-pts',
    type: 'circle',
    source: 'calendar',
    paint: {
      'circle-radius': ['*', ['get', 'r'], 0.5],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.9,
      'circle-stroke-color': '#05070a',
      'circle-stroke-width': 1,
    },
  });
  map.addLayer({
    id: 'geo-pts',
    type: 'circle',
    source: 'geo',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.8, 6, 5],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.9,
      'circle-stroke-color': '#05070a',
      'circle-stroke-width': 0.6,
    },
  });
}

function deckLayers(t: number, flows: FlowDatum[]) {
  const interleave = { beforeId: 'banks-halo' };
  const arcs = new ArcLayer<FlowDatum>({
    id: 'flows-arc',
    data: flows,
    greatCircle: true,
    getSourcePosition: (d) => d.from,
    getTargetPosition: (d) => d.to,
    getSourceColor: [212, 175, 55, 150],
    getTargetColor: [34, 211, 238, 140],
    getWidth: (d) => 0.6 + d.weight * 0.45,
    widthUnits: 'pixels',
    getHeight: 0.22,
    pickable: true,
    ...interleave,
  });
  const segs = flows.map((f) => {
    const speed = 0.00006 * (0.7 + f.weight * 0.15);
    const head = (t * speed + f.phase) % 1;
    const tail = Math.max(0, head - 0.14);
    const path: [number, number][] = [];
    for (let i = 0; i <= 10; i++) path.push(greatCirclePoint(f.from, f.to, tail + ((head - tail) * i) / 10));
    return { id: f.id, path, w: f.weight };
  });
  const trails = new PathLayer<(typeof segs)[number]>({
    id: 'flows-trail',
    data: segs,
    getPath: (d) => d.path,
    getColor: [255, 226, 140, 235],
    getWidth: (d) => 1.6 + d.w * 0.45,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    wrapLongitude: true,
    pickable: true,
    ...interleave,
  });
  return [arcs, trails];
}

function MapView(props: Props) {
  const { layers, projection, basemap, data, flows, producers, reserves, selection, onSelect, flyTo, children } = props;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [glLost, setGlLost] = useState(false);

  // mutowalne referencje do pętli animacji (bez przerysowywania Reacta)
  const live = useRef({
    flows,
    hubsOn: layers.hubs,
    calOn: layers.calendar,
    chokeOn: layers.choke,
    deckActive: false,
    selection,
    onSelect,
    lastInteract: Date.now(),
    projection,
  });
  live.current.flows = flows;
  live.current.hubsOn = layers.hubs;
  live.current.calOn = layers.calendar;
  live.current.chokeOn = layers.choke;
  live.current.selection = selection;
  live.current.onSelect = onSelect;
  live.current.projection = projection;

  /* ── inicjalizacja ── */
  useEffect(() => {
    if (!el.current) return;
    let map: MLMap;
    try {
      map = new MLMap({
        container: el.current,
        style: buildStyle(),
        center: [20, 28],
        zoom: 1.55,
        minZoom: 0.6,
        maxZoom: 10,
        attributionControl: { compact: true },
        fadeDuration: 150,
      });
    } catch (e) {
      // brak WebGL (stara karta, wyłączona akceleracja) — panele działają dalej
      setFatal(e instanceof Error ? e.message : String(e));
      return;
    }
    mapRef.current = map;
    map.on('webglcontextlost', () => setGlLost(true));
    map.on('webglcontextrestored', () => setGlLost(false));
    map.on('error', (ev) => {
      const err = (ev as unknown as { error?: Error })?.error;
      if (err) console.warn('[map]', err.message); // np. pojedynczy kafelek — nie przerywamy działania
    });

    // zmiana rozmiaru kontenera (szuflady, obrót telefonu) → mapa i tryb popupu
    const ro = new ResizeObserver(() => {
      const w = el.current?.clientWidth ?? 1000;
      setMobile(w < 640);
      map.resize();
    });
    ro.observe(el.current);
    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay as unknown as IControl);

    const markInteract = () => {
      live.current.lastInteract = Date.now();
    };
    map.on('mousedown', markInteract);
    map.on('touchstart', markInteract);
    map.on('wheel', markInteract);

    map.on('load', () => {
      addLayers(map);
      setReady(true);
    });

    map.on('click', (e) => {
      markInteract();
      const pad = 6;
      const bbox: [PointLike, PointLike] = [
        [e.point.x - pad, e.point.y - pad],
        [e.point.x + pad, e.point.y + pad],
      ];
      const existing = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const feats = map.queryRenderedFeatures(bbox, { layers: existing });
      const pointFeat = feats[0];
      if (pointFeat && pointFeat.geometry.type === 'Point') {
        const c = pointFeat.geometry.coordinates as [number, number];
        live.current.onSelect({ kind: String(pointFeat.properties?.kind), id: String(pointFeat.properties?.id), lngLat: c });
        return;
      }
      const picked = overlay.pickObject({ x: e.point.x, y: e.point.y, radius: 3, layerIds: ['flows-arc', 'flows-trail'] });
      const obj = picked?.object as { id?: string } | undefined;
      if (obj?.id) {
        live.current.onSelect({ kind: 'flow', id: obj.id, lngLat: [e.lngLat.lng, e.lngLat.lat] });
        return;
      }
      // dowolny inny punkt: gdy popup jest otwarty — zamknij; w przeciwnym razie pokaż kartę lokalizacji
      if (live.current.selection) {
        live.current.onSelect(null);
        return;
      }
      const land = map.queryRenderedFeatures(e.point, { layers: ['countries-hit'] })[0];
      const name = land ? String(land.properties?.name ?? '') : '';
      const iso = land ? String(land.properties?.iso ?? '') : '';
      live.current.onSelect({
        kind: 'loc',
        id: `${e.lngLat.lng.toFixed(3)},${e.lngLat.lat.toFixed(3)}|${name}|${iso}`,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    });

    map.on('mousemove', (e) => {
      const existing = INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
      const f = map.queryRenderedFeatures(e.point, { layers: existing });
      map.getCanvas().style.cursor = f.length ? 'pointer' : 'crosshair';
    });

    // pętla animacji: rotacja globu płynnie co klatkę (zależnie od czasu klatki),
    // efekty (pulsowanie, przepływy) ~30 fps i tylko dla włączonych warstw
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let lastT = 0;
    let lastFx = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = lastT ? Math.min(100, t - lastT) : 16;
      lastT = t;
      if (!map.isStyleLoaded()) return;
      const L = live.current;
      if (!reduce && L.projection === 'globe' && !L.selection && Date.now() - L.lastInteract > 20_000 && !map.isMoving()) {
        const c = map.getCenter();
        map.setCenter([c.lng + dt * 0.0012, c.lat]); // ~1,2°/s
      }
      if (t - lastFx < 33) return;
      lastFx = t;
      if (!reduce) {
        const ph = (t % 2200) / 2200;
        const ph2 = (t % 1500) / 1500;
        if (L.calOn && map.getLayer('cal-halo')) {
          map.setPaintProperty('cal-halo', 'circle-radius', ['+', ['*', ['get', 'r'], 0.5], ph * 16]);
          map.setPaintProperty('cal-halo', 'circle-stroke-opacity', 0.7 * (1 - ph));
        }
        if (L.chokeOn && map.getLayer('choke-halo')) {
          map.setPaintProperty('choke-halo', 'circle-radius', 6 + ph2 * 16);
          map.setPaintProperty('choke-halo', 'circle-stroke-opacity', 0.8 * (1 - ph2));
        }
      }
      const wantFlows = L.hubsOn && L.flows.length > 0;
      if (wantFlows) overlay.setProps({ layers: deckLayers(reduce ? 0 : t, L.flows) });
      else if (L.deckActive) overlay.setProps({ layers: [] });
      L.deckActive = wantFlows;
    };
    raf = requestAnimationFrame(tick);

    const nightTimer = setInterval(() => {
      (map.getSource('night') as GeoJSONSource | undefined)?.setData(nightPolygon(new Date()));
    }, 60_000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(nightTimer);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── dane warstw ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of SOURCE_IDS) {
      const fc = data[id];
      if (fc) (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
    }
  }, [data, ready]);

  /* ── choropleth producentów ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const withT: FeatureCollection = {
      type: 'FeatureCollection',
      features: countriesFC.features.map((f) => {
        const iso = String(f.id ?? '').padStart(3, '0');
        return { ...f, properties: { ...(f.properties ?? {}), iso, tonnes: producers[iso] ?? 0, reserves: reserves[iso] ?? 0 } };
      }),
    };
    (map.getSource('countries') as GeoJSONSource | undefined)?.setData(withT);
  }, [producers, reserves, ready]);

  /* ── widoczność warstw ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [lid, ids] of Object.entries(MAP_LAYER_IDS) as [LayerId, string[]][]) {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers[lid] ? 'visible' : 'none');
    }
  }, [layers, ready]);

  /* ── podkład MAP / SAT ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty('carto', 'visibility', basemap === 'map' ? 'visible' : 'none');
    map.setLayoutProperty('esri', 'visibility', basemap === 'sat' ? 'visible' : 'none');
    map.setPaintProperty('carto-labels', 'raster-opacity', basemap === 'sat' ? 0.85 : 0.55);
  }, [basemap, ready]);

  /* ── projekcja 3D / 2D z płynnym przejściem ── */
  const firstProj = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (firstProj.current) {
      firstProj.current = false;
      if (projection === 'globe') return;
    }
    const z = map.getZoom();
    map.easeTo({ zoom: Math.min(z, 1.4), pitch: 0, duration: 450 });
    map.once('moveend', () => {
      map.setProjection({ type: projection });
      map.easeTo({ zoom: projection === 'mercator' ? Math.max(z, 1.6) : z, duration: 650 });
    });
  }, [projection, ready]);

  /* ── fly-to (np. klik w newsie w panelu) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyTo) return;
    live.current.lastInteract = Date.now();
    map.flyTo({ center: flyTo.lngLat, zoom: Math.max(map.getZoom(), flyTo.zoom ?? 3), speed: 1.4 });
  }, [flyTo, ready]);

  /* ── pozycja popupu: aktualizacja stylu bezpośrednio (bez setState przy każdej klatce ruchu) ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selection || mobile) return;
    const half = 170;
    const update = () => {
      const pop = popRef.current;
      const dot = dotRef.current;
      if (!pop || !dot) return;
      const [lng, lat] = selection.lngLat;
      let visible = true;
      if (live.current.projection === 'globe') {
        const c = map.getCenter();
        const R = Math.PI / 180;
        const cosD = Math.sin(lat * R) * Math.sin(c.lat * R) + Math.cos(lat * R) * Math.cos(c.lat * R) * Math.cos((lng - c.lng) * R);
        visible = cosD >= 0.12; // punkt po drugiej stronie globu
      }
      pop.style.visibility = dot.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      const p = map.project([lng, lat]);
      const w = el.current?.clientWidth ?? 1000;
      const H = el.current?.clientHeight ?? 800;
      dot.style.transform = `translate(${p.x - 6}px, ${p.y - 6}px)`;
      // karta zawsze w granicach mapy: nad punktem, pod punktem, a gdy żadne nie pasuje — przy krawędzi z przewijaniem
      pop.style.maxHeight = `${H - 16}px`;
      const h = pop.offsetHeight;
      const above = p.y - 16 - h;
      const below = p.y + 16;
      const top = above >= 8 ? above : below + h <= H - 8 ? below : Math.min(Math.max(8, above), Math.max(8, H - h - 8));
      pop.style.left = `${Math.max(half + 8, Math.min(w - half - 8, p.x))}px`;
      pop.style.top = `${top}px`;
      pop.style.transform = 'translateX(-50%)';
    };
    update();
    map.on('move', update);
    map.on('resize', update);
    return () => {
      map.off('move', update);
      map.off('resize', update);
    };
  }, [selection, ready, mobile]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" />
      {selection && children && mobile && <div className="absolute inset-x-2 bottom-12 z-20">{children}</div>}
      {selection && children && !mobile && (
        <>
          <div
            ref={dotRef}
            className="pointer-events-none absolute left-0 top-0 z-10 h-3 w-3 rounded-full border border-data"
            style={{ boxShadow: '0 0 12px #22d3ee', visibility: 'hidden' }}
          />
          <div ref={popRef} className="pointer-events-none absolute z-20 overflow-y-auto" style={{ visibility: 'hidden' }}>
            <div className="pointer-events-auto">{children}</div>
          </div>
        </>
      )}
      {!ready && !fatal && (
        <div className="absolute inset-0 grid place-items-center text-xs tracking-[0.3em] text-data/70">INITIALIZING GLOBE…</div>
      )}
      {fatal && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[11px] leading-relaxed text-muted">
          <div>
            <div className="mb-1 tracking-[0.3em] text-warn">MAPA NIEDOSTĘPNA</div>
            Przeglądarka nie udostępnia WebGL (wyłączona akceleracja sprzętowa lub stary sterownik).
            <br />
            Panele po prawej działają normalnie. Szczegóły: {fatal}
          </div>
        </div>
      )}
      {glLost && !fatal && (
        <div className="absolute inset-x-0 top-12 z-30 mx-auto w-fit border border-warn/60 bg-panel/90 px-3 py-1 text-[10px] tracking-wider text-warn">
          Utracono kontekst WebGL — przywracanie mapy…
        </div>
      )}
    </div>
  );
}

export default memo(MapView);

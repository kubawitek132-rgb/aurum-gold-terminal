/** Zamiana danych API na GeoJSON dla warstw MapLibre (czyste funkcje). */
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { CalendarEvent, CentralBank, Chokepoint, GeoEvent, GoldHub, RegionRisk } from './types';
import { CHOKE_COLOR, LEVEL_COLOR, STANCE_COLOR } from './layers';

type FC = FeatureCollection<Point>;
const pt = (lon: number, lat: number, props: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: props,
});
const fc = (features: Feature<Point>[]): FC => ({ type: 'FeatureCollection', features });

export function calendarFC(events: CalendarEvent[], now: number, rangeH: number): FC {
  const perCountry = new Map<string, number>();
  const feats: Feature<Point>[] = [];
  for (const e of events) {
    const dh = (e.time - now) / 3600000;
    if (dh < -1 || dh > rangeH) continue;
    const i = perCountry.get(e.currency) ?? 0;
    perCountry.set(e.currency, i + 1);
    const ang = i * 2.399;
    const r = i === 0 ? 0 : 1.2 + Math.sqrt(i) * 0.9;
    const proximity = Math.max(0, Math.min(1, 1 - Math.max(0, dh) / rangeH));
    feats.push(
      pt(e.lon + Math.cos(ang) * r, e.lat + Math.sin(ang) * r, {
        kind: 'cal',
        id: e.id,
        color: e.kind === 'cb' ? '#D4AF37' : e.impact === 'High' ? '#ef4444' : '#f59e0b',
        r: 5 + proximity * 9 + (dh < 24 ? 3 : 0),
      }),
    );
  }
  return fc(feats);
}

export function banksFC(banks: CentralBank[]): FC {
  return fc(
    banks.map((b) =>
      pt(b.lon, b.lat, {
        kind: 'bank',
        id: b.id,
        color: STANCE_COLOR[b.stance],
        ring: b.goldTrend === 'buying' ? '#facc15' : '#D4AF37',
        r: 6 + Math.min(8, Math.sqrt(b.goldReservesT ?? 0) / 12),
      }),
    ),
  );
}

export function riskFC(regions: RegionRisk[]): FC {
  return fc(
    regions.map((r) =>
      pt(r.lon, r.lat, {
        kind: 'risk',
        id: r.id,
        color: LEVEL_COLOR[r.level],
        r: 14 + Math.min(30, Math.max(0, ((r.ratio ?? 1) - 0.6) * 22)),
      }),
    ),
  );
}

export function geoFC(events: GeoEvent[]): FC {
  return fc(
    events.map((e) =>
      pt(e.lon, e.lat, {
        kind: 'geo',
        id: e.id,
        color:
          e.category === 'conflict' ? '#ef4444' : e.category === 'sanctions' ? '#f97316' : e.category === 'trade' ? '#eab308' : e.category === 'diplomacy' ? '#22c55e' : '#94a3b8',
        w: e.category === 'conflict' ? 1 : e.category === 'diplomacy' ? 0.3 : 0.6,
      }),
    ),
  );
}

export function chokeFC(items: Chokepoint[]): FC {
  return fc(
    items.map((c) =>
      pt(c.lon, c.lat, {
        kind: 'choke',
        id: c.id,
        color: CHOKE_COLOR[c.status],
        alert: c.status === 'ELEVATED' || c.status === 'DISRUPTED' ? 1 : 0,
      }),
    ),
  );
}

export function hubsFC(hubs: GoldHub[]): FC {
  return fc(hubs.map((h) => pt(h.lon, h.lat, { kind: 'hub', id: h.id, color: '#D4AF37' })));
}

import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';

const RAD = Math.PI / 180;

/** Punkt podsłoneczny (przybliżenie astronomiczne, dokładność ~0.1°). */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) % 360;
  const q = (280.459 + 0.98564736 * d) % 360;
  const L = q + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
  const e = 23.439 - 0.00000036 * d;
  const ra = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / RAD;
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) / RAD;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  let lon = ra - gmst * 15;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: dec, lon };
}

/** Wielokąt strony nocnej (terminator). */
export function nightPolygon(date: Date): Feature<Polygon> {
  const sun = subsolarPoint(date);
  let dec = sun.lat;
  if (Math.abs(dec) < 0.01) dec = dec < 0 ? -0.01 : 0.01;
  const coords: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const lat = Math.atan(-Math.cos((lon - sun.lon) * RAD) / Math.tan(dec * RAD)) / RAD;
    coords.push([lon, Math.max(-89.9, Math.min(89.9, lat))]);
  }
  const pole = dec > 0 ? -89.9 : 89.9; // noc obejmuje biegun przeciwny do Słońca
  coords.push([180, pole], [-180, pole], coords[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Siatka południków/równoleżników co `step` stopni. */
export function graticule(step = 30): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (let lon = -180; lon < 180; lon += step) {
    const c: [number, number][] = [];
    for (let lat = -85; lat <= 85; lat += 5) c.push([lon, lat]);
    features.push({ type: 'Feature', properties: { kind: 'meridian' }, geometry: { type: 'LineString', coordinates: c } });
  }
  for (let lat = -60; lat <= 60; lat += step) {
    const c: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 5) c.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { kind: lat === 0 ? 'equator' : 'parallel' },
      geometry: { type: 'LineString', coordinates: c },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Interpolacja po wielkim kole (t ∈ [0,1]). */
export function greatCirclePoint(a: [number, number], b: [number, number], t: number): [number, number] {
  const [lon1, lat1] = [a[0] * RAD, a[1] * RAD];
  const [lon2, lat2] = [b[0] * RAD, b[1] * RAD];
  const d =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2),
    );
  if (d === 0) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD];
}

/** Deterministyczny „jitter”, żeby markery w tym samym miejscu się nie nakładały. */
export function jitter(seed: string, amount = 0.6): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000;
  const b = (((h >>> 10) >>> 0) % 1000) / 1000;
  return [(a - 0.5) * 2 * amount, (b - 0.5) * 2 * amount];
}

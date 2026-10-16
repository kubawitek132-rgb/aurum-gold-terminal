/**
 * Provider (opcjonalny): aisstream.io — liczba statków w obrębie chokepointów (okno 60 min).
 * Włącza się automatycznie, gdy ustawiono AISSTREAM_API_KEY. Używa globalnego WebSocket (Node ≥ 22).
 * Typ statku pochodzi z wiadomości ShipStaticData (kody AIS 80–89 = tankowce) — tankowce liczone osobno.
 */
import chokeData from '@/data/chokepoints.json';

interface State {
  started: boolean;
  seen: Map<string, Map<number, number>>; // chokepointId → MMSI → ts
  types: Map<number, number>; // MMSI → kod typu AIS
  updatedAt: number;
  error?: string;
}
const g = globalThis as unknown as { __ais?: State };
const state: State = g.__ais ?? (g.__ais = { started: false, seen: new Map(), types: new Map(), updatedAt: 0 });
if (!state.types) state.types = new Map();

const WINDOW_MIN = 60;

type Choke = { id: string; bbox: number[] };
const CHOKES = (chokeData as { chokepoints: Choke[] }).chokepoints;

export function aisEnabled() {
  return !!process.env.AISSTREAM_API_KEY;
}

function which(lat: number, lon: number): string | null {
  for (const c of CHOKES) {
    const [a, b, cc, d] = c.bbox;
    if (lat >= a && lat <= cc && lon >= b && lon <= d) return c.id;
  }
  return null;
}

export function startAis() {
  if (!aisEnabled() || state.started) return;
  const WS = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WS) {
    state.error = 'Brak globalnego WebSocket (wymagany Node ≥ 22)';
    return;
  }
  state.started = true;
  const connect = () => {
    const ws = new WS('wss://stream.aisstream.io/v0/stream');
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          APIKey: process.env.AISSTREAM_API_KEY,
          BoundingBoxes: CHOKES.map((c) => [
            [c.bbox[0], c.bbox[1]],
            [c.bbox[2], c.bbox[3]],
          ]),
          FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
        }),
      );
    };
    ws.onmessage = async (ev: MessageEvent) => {
      try {
        const text = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
        const msg = JSON.parse(text) as {
          MessageType?: string;
          MetaData?: { MMSI?: number; latitude?: number; longitude?: number };
          Message?: { ShipStaticData?: { Type?: number } };
        };
        const m = msg.MetaData;
        if (msg.MessageType === 'ShipStaticData') {
          const t = msg.Message?.ShipStaticData?.Type;
          if (m?.MMSI && typeof t === 'number') {
            if (state.types.size > 50_000) state.types.clear();
            state.types.set(m.MMSI, t);
          }
          return;
        }
        if (!m?.MMSI || m.latitude === undefined || m.longitude === undefined) return;
        const id = which(m.latitude, m.longitude);
        if (!id) return;
        if (!state.seen.has(id)) state.seen.set(id, new Map());
        state.seen.get(id)!.set(m.MMSI, Date.now());
        state.updatedAt = Date.now();
      } catch {
        /* pomijamy uszkodzone wiadomości */
      }
    };
    ws.onerror = () => {
      state.error = 'błąd połączenia AIS';
    };
    ws.onclose = () => {
      setTimeout(connect, 30_000);
    };
  };
  connect();
}

export interface AisCount {
  vessels: number;
  tankers: number;
  windowMin: number;
  updatedAt: number;
}

export function aisCounts(): Record<string, AisCount> {
  const out: Record<string, AisCount> = {};
  const cutoff = Date.now() - WINDOW_MIN * 60000;
  for (const [id, m] of state.seen) {
    let tankers = 0;
    for (const [mmsi, ts] of m) {
      if (ts < cutoff) m.delete(mmsi);
      else {
        const t = state.types.get(mmsi);
        if (t !== undefined && t >= 80 && t <= 89) tankers++;
      }
    }
    out[id] = { vessels: m.size, tankers, windowMin: WINDOW_MIN, updatedAt: state.updatedAt };
  }
  return out;
}

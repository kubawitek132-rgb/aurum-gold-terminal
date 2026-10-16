import type { SourceResult } from './types';
import { redisGet, redisSet } from './redis';

/**
 * Cache w pamięci procesu (stale-while-revalidate):
 *  - TTL: świeże dane zwracane od razu,
 *  - po upływie TTL zwracamy OSTATNIĄ wartość natychmiast, a odświeżenie idzie w tle
 *    (żądanie z przeglądarki nigdy nie czeka na wolne źródło, np. kolejkę GDELT),
 *  - zimny start: czekamy najwyżej `firstWaitMs` na pierwsze pobranie, potem oddajemy
 *    fallback z flagą `pending` — klient dopyta szybciej, gdy dane dojdą,
 *  - deduplikacja równoległych zapytań (inflight),
 *  - tryb STALE: gdy źródło padnie, zostaje ostatnia dobra wartość z flagą stale,
 *  - backoff po błędzie (nie bombardujemy niedziałającego API),
 *  - opcjonalna trwałość w Redis (REDIS_URL): po restarcie dane wracają od razu.
 *
 * Trzymany na globalThis, żeby przetrwał hot-reload w trybie dev.
 */

interface Entry {
  value?: SourceResult<unknown>;
  fetchedAt: number; // kiedy ostatnio próbowaliśmy (sukces lub błąd)
  inflight?: Promise<SourceResult<unknown>>;
  redisChecked?: boolean;
}

type Store = Map<string, Entry>;
const g = globalThis as unknown as { __aurumCache?: Store };
const store: Store = g.__aurumCache ?? (g.__aurumCache = new Map());

export interface Loaded<T> {
  data: T;
  source: string;
}

export interface CacheOptions<T> {
  ttlMs: number;
  /** po błędzie następna próba najwcześniej po tylu ms (domyślnie min(ttl, 60s)) */
  retryMs?: number;
  /** wywoływane, gdy brak jakiejkolwiek dobrej wartości; missing=false dla prawdziwych danych zastępczych */
  fallback?: () => Loaded<T> & { missing?: boolean };
  /** pozwala pominąć odświeżenie (np. rynek zamknięty) — zwraca wtedy ostatnią wartość jako świeżą */
  skipRefresh?: () => boolean;
  /** zimny start: ile najdłużej czekać na pierwsze pobranie, zanim oddamy fallback z `pending` (domyślnie 6 s) */
  firstWaitMs?: number;
}

const timeout = (ms: number) =>
  new Promise<'timeout'>((r) => {
    const t = setTimeout(() => r('timeout'), ms) as unknown as { unref?: () => void };
    t.unref?.();
  });

export async function cached<T>(
  key: string,
  loader: () => Promise<Loaded<T>>,
  opts: CacheOptions<T>,
): Promise<SourceResult<T>> {
  let e = store.get(key);
  if (!e) {
    e = { fetchedAt: 0 };
    store.set(key, e);
  }
  const entry = e;

  // zimny start: spróbuj odtworzyć ostatnią dobrą wartość z Redis
  if (!entry.value && !entry.redisChecked) {
    entry.redisChecked = true;
    const saved = await redisGet<SourceResult<T>>(key);
    if (saved && !entry.value) {
      entry.value = saved;
      entry.fetchedAt = saved.updatedAt ?? 0;
    }
  }

  if (entry.value && opts.skipRefresh?.()) return entry.value as SourceResult<T>;

  const now = Date.now();
  const retryMs = opts.retryMs ?? Math.min(opts.ttlMs, 60_000);
  const lastWasError = !!entry.value?.stale || !entry.value;
  const due = now - entry.fetchedAt >= (lastWasError && entry.fetchedAt > 0 ? retryMs : opts.ttlMs);

  if (!due && entry.value) return entry.value as SourceResult<T>;

  if (!entry.inflight) {
    const p = (async (): Promise<SourceResult<T>> => {
      try {
        const res = await loader();
        const out: SourceResult<T> = { data: res.data, source: res.source, updatedAt: Date.now(), stale: false };
        entry.value = out;
        void redisSet(key, out, Math.max(opts.ttlMs * 20, 86_400_000));
        return out;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[cache] ${key} failed: ${msg}`);
        if (entry.value && !entry.value.missing && entry.value.updatedAt) {
          const out = { ...(entry.value as SourceResult<T>), stale: true, error: msg };
          entry.value = out;
          return out;
        }
        if (opts.fallback) {
          const fb = opts.fallback();
          const out: SourceResult<T> = { data: fb.data, source: fb.source, updatedAt: null, stale: true, missing: fb.missing ?? true, error: msg };
          entry.value = out;
          return out;
        }
        throw err;
      } finally {
        entry.fetchedAt = Date.now();
        entry.inflight = undefined;
      }
    })();
    p.catch(() => undefined); // odświeżenie w tle nie może zostawić nieobsłużonego odrzucenia
    entry.inflight = p;
  }
  const inflight = entry.inflight as Promise<SourceResult<T>>;

  // jest jakaś wartość → oddaj ją od razu, odświeżenie trwa w tle
  if (entry.value) {
    const v = entry.value as SourceResult<T>;
    return v.missing ? { ...v, pending: true } : v;
  }

  // zimny start bez wartości: krótko czekamy, potem fallback z flagą pending
  const first = await Promise.race([inflight, timeout(opts.firstWaitMs ?? 6000)]);
  if (first !== 'timeout') return first;
  if (opts.fallback) {
    const fb = opts.fallback();
    return { data: fb.data, source: `${fb.source} · ładowanie…`, updatedAt: null, stale: true, missing: fb.missing ?? true, pending: true };
  }
  return inflight;
}

/** Odczyt bez odświeżania (np. do panelu statusu). */
export function peek<T>(key: string): (SourceResult<T> & { inflight: boolean }) | undefined {
  const e = store.get(key);
  return e?.value ? { ...(e.value as SourceResult<T>), inflight: !!e.inflight } : undefined;
}

export function cacheKeys(): string[] {
  return [...store.keys()];
}

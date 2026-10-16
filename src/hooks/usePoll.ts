'use client';

import { useEffect, useRef, useState } from 'react';

const FAST_RETRY_MS = 15_000; // serwer jeszcze ładuje (pending) → dopytaj szybko
const ERR_BASE_MS = 10_000; // błąd sieci → 10 s, 20 s, 40 s… aż do intervalMs
const VIS_MIN_AGE_MS = 60_000; // powrót do karty odświeża tylko dane starsze niż minuta

function isPending(j: unknown): boolean {
  const o = j as { pending?: boolean; macro?: { pending?: boolean } } | null;
  return !!(o?.pending || o?.macro?.pending);
}

/**
 * Cykliczne pobieranie JSON z API.
 *  - gdy serwer oddaje dane zastępcze w trakcie pierwszego pobrania (pending) → ponowienie po 15 s,
 *  - po błędzie wykładniczy backoff (bez czekania pełnego interwału),
 *  - powrót do karty / powrót sieci → odświeżenie, jeśli dane są starsze niż minuta,
 *  - przerwane żądania przy odmontowaniu (AbortController).
 */
export function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const inflight = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errors = 0;
    const ctrl = new AbortController();

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (alive) timer = setTimeout(run, ms);
    };

    const run = async () => {
      if (inflight.current || !alive) return;
      inflight.current = true;
      clearTimeout(timer);
      let next = intervalMs;
      try {
        const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as T;
        errors = 0;
        last.current = Date.now();
        if (alive) {
          setData(j);
          setError(null);
          setFetchedAt(last.current);
        }
        if (isPending(j)) next = Math.min(intervalMs, FAST_RETRY_MS);
      } catch (e) {
        if (!alive || (e instanceof DOMException && e.name === 'AbortError')) return;
        errors++;
        next = Math.min(intervalMs, ERR_BASE_MS * 2 ** (errors - 1));
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        inflight.current = false;
        schedule(next);
      }
    };

    run();
    const refreshIfOld = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > VIS_MIN_AGE_MS) run();
    };
    document.addEventListener('visibilitychange', refreshIfOld);
    window.addEventListener('online', refreshIfOld);
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(timer);
      inflight.current = false;
      document.removeEventListener('visibilitychange', refreshIfOld);
      window.removeEventListener('online', refreshIfOld);
    };
  }, [url, intervalMs]);

  return { data, error, fetchedAt };
}

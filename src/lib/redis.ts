/**
 * Opcjonalna trwałość cache w Redis. Aktywna tylko, gdy ustawiono REDIS_URL (np. redis://redis:6379).
 * Każdy błąd Redis jest ignorowany — aplikacja działa wtedy jak z samym cache w pamięci.
 */

interface MiniRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', ms: number): Promise<unknown>;
}

const g = globalThis as unknown as { __aurumRedis?: Promise<MiniRedis | null> };
const PREFIX = process.env.REDIS_PREFIX || 'aurum:';

export function redisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

function client(): Promise<MiniRedis | null> {
  if (!redisEnabled()) return Promise.resolve(null);
  if (!g.__aurumRedis) {
    g.__aurumRedis = (async () => {
      try {
        type Client = MiniRedis & { status: string; on(ev: string, fn: (e?: unknown) => void): void; once(ev: string, fn: () => void): void };
        const mod = (await import('ioredis')) as unknown as { default: new (url: string, opts: Record<string, unknown>) => Client };
        const c = new mod.default(process.env.REDIS_URL as string, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 3000 });
        c.on('error', (e) => console.warn(`[redis] ${e instanceof Error ? e.message : e}`));
        // bez kolejki offline komendy przed nawiązaniem połączenia od razu by padały —
        // czekamy na „ready” (maks. 3 s), żeby odczyt cache po restarcie zadziałał
        if (c.status !== 'ready') {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 3000);
            c.once('ready', () => {
              clearTimeout(t);
              resolve();
            });
          });
        }
        return c;
      } catch (e) {
        console.warn(`[redis] niedostępny: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    })();
  }
  return g.__aurumRedis;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const c = await client();
  if (!c) return null;
  try {
    const raw = await c.get(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const c = await client();
  if (!c) return;
  try {
    await c.set(PREFIX + key, JSON.stringify(value), 'PX', Math.round(ttlMs));
  } catch {
    /* ignorujemy — cache w pamięci nadal działa */
  }
}

/**
 * Mały trwały magazyn stanu (np. „skrót wysłany dziś”, poprzednie statusy chokepointów).
 * Redis, gdy ustawiono REDIS_URL; w przeciwnym razie plik JSON w DATA_DIR (domyślnie ./.data).
 * Błędy zapisu nie zatrzymują aplikacji — stan zostaje wtedy tylko w pamięci.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { redisEnabled, redisGet, redisSet } from './redis';

const DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'state.json');
const g = globalThis as unknown as { __kv?: { mem: Record<string, unknown>; loaded: boolean; writing?: Promise<void> } };
const st = g.__kv ?? (g.__kv = { mem: {}, loaded: false });
const YEAR = 365 * 86_400_000;

async function load() {
  if (st.loaded) return;
  st.loaded = true;
  try {
    st.mem = { ...JSON.parse(await fs.readFile(FILE, 'utf8')), ...st.mem };
  } catch {
    /* brak pliku przy pierwszym starcie */
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (redisEnabled()) {
    const v = await redisGet<T>(`kv:${key}`);
    if (v !== null) return v;
  }
  await load();
  return (st.mem[key] as T) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  st.mem[key] = value;
  if (redisEnabled()) await redisSet(`kv:${key}`, value, YEAR);
  await load();
  const write = async () => {
    try {
      await fs.mkdir(DIR, { recursive: true });
      const tmp = FILE + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(st.mem));
      await fs.rename(tmp, FILE);
    } catch (e) {
      console.warn(`[kv] zapis do ${FILE} nieudany: ${e instanceof Error ? e.message : e}`);
    }
  };
  st.writing = (st.writing ?? Promise.resolve()).then(write);
  await st.writing;
}

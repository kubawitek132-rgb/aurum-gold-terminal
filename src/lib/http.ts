const UA = 'AURUM-Gold-Terminal/1.0 (+self-hosted dashboard)';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function doFetch(url: string, timeoutMs: number, headers?: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
      cache: 'no-store',
    });
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status} for ${redact(url)}`);
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(`timeout ${timeoutMs}ms for ${redact(url)}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 12_000, headers?: Record<string, string>): Promise<T> {
  const res = await doFetch(url, timeoutMs, { Accept: 'application/json', ...headers });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`invalid JSON from ${redact(url)}: ${text.slice(0, 120)}`);
  }
}

export async function fetchText(url: string, timeoutMs = 15_000, headers?: Record<string, string>): Promise<string> {
  const res = await doFetch(url, timeoutMs, headers);
  return res.text();
}

export async function fetchBuffer(url: string, timeoutMs = 30_000, headers?: Record<string, string>): Promise<Buffer> {
  const res = await doFetch(url, timeoutMs, headers);
  return Buffer.from(await res.arrayBuffer());
}

/** Ukrywa klucze API w logach. */
export function redact(url: string): string {
  return url.replace(/(api_?key|apikey|token)=[^&]+/gi, '$1=***');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

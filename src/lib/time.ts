/** Helpery czasu działające po stronie serwera i klienta (bez bibliotek). */

export const WARSAW = 'Europe/Warsaw';

/** Minuty od północy w danej strefie czasowej oraz dzień tygodnia (0=nd). */
export function zonedParts(date: Date, tz: string): { minutes: number; weekday: number; y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return {
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: wd,
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

/** Przesunięcie strefy względem UTC w minutach (np. +120 dla Warszawy latem). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60);
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - actual) / 60000);
}

/** Instant (ms) odpowiadający północy bieżącego dnia w strefie tz. */
export function zonedMidnight(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const guess = Date.UTC(p.y, p.m - 1, p.d) - tzOffsetMinutes(date, tz) * 60000;
  // korekta przy zmianie czasu
  const off2 = tzOffsetMinutes(new Date(guess), tz);
  return Date.UTC(p.y, p.m - 1, p.d) - off2 * 60000;
}

export function fmtTime(ms: number, tz = WARSAW, withDate = false): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    ...(withDate ? { day: '2-digit', month: '2-digit' } : {}),
  }).format(new Date(ms));
}

export function fmtDateTime(ms: number, tz = WARSAW): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'TERAZ';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function fmtAgo(ms: number | null, now = Date.now()): string {
  if (!ms) return '—';
  const diff = Math.max(0, now - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'teraz';
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h temu`;
  return `${Math.floor(h / 24)} d temu`;
}

/** Rynek FX/złota zamknięty: od pt 17:00 NY do nd 17:00 NY (+ codzienna przerwa 17:00-18:00 NY dla COMEX pomijana). */
export function isFxWeekendClosed(date = new Date()): boolean {
  const p = zonedParts(date, 'America/New_York');
  if (p.weekday === 6) return true;
  if (p.weekday === 5 && p.minutes >= 17 * 60) return true;
  if (p.weekday === 0 && p.minutes < 17 * 60) return true;
  return false;
}

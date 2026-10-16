/**
 * Kalendarz strukturalny rynku złota — zdarzenia, które nie są „publikacjami makro”,
 * ale wpływają na płynność, przepływy fizyczne i pozycjonowanie:
 *  - COMEX (GC/OG): wygasanie opcji, First Notice Day, ostatni dzień handlu — liczone wg reguł CME,
 *  - cykliczne publikacje: raport CFTC COT (piątki), rezerwy PBoC (~7. dnia), WGC Gold Demand Trends,
 *  - stałe zdarzenia z src/data/gold-calendar.json (święta LBMA/SGE/USA, sezony popytu w Indiach i Chinach),
 *  - decyzje banków centralnych (z central-banks.json).
 */
import type { GoldCalEvent } from './types';
import calJson from '@/data/gold-calendar.json';
import banksJson from '@/data/central-banks.json';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Wielkanoc (algorytm Meeusa/Jonesa/Butchera). */
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

function nthWeekday(y: number, m: number, wd: number, n: number): Date {
  const first = utc(y, m, 1);
  const off = (wd - first.getUTCDay() + 7) % 7;
  return utc(y, m, 1 + off + (n - 1) * 7);
}
function lastWeekday(y: number, m: number, wd: number): Date {
  const last = utc(y, m + 1, 0);
  const off = (last.getUTCDay() - wd + 7) % 7;
  return utc(y, m, last.getUTCDate() - off);
}
function observed(d: Date): Date {
  const wd = d.getUTCDay();
  if (wd === 6) return new Date(d.getTime() - 86400000);
  if (wd === 0) return new Date(d.getTime() + 86400000);
  return d;
}

/** Święta, w które CME nie rozlicza kontraktów (uproszczenie: federalne + Wielki Piątek). */
export function usHolidays(y: number): Map<string, string> {
  const h = new Map<string, string>();
  const add = (d: Date, name: string) => h.set(ymd(d), name);
  add(observed(utc(y, 0, 1)), 'Nowy Rok');
  add(nthWeekday(y, 0, 1, 3), 'Martin Luther King Day');
  add(nthWeekday(y, 1, 1, 3), "Presidents' Day");
  add(new Date(easter(y).getTime() - 2 * 86400000), 'Wielki Piątek');
  add(lastWeekday(y, 4, 1), 'Memorial Day');
  add(observed(utc(y, 5, 19)), 'Juneteenth');
  add(observed(utc(y, 6, 4)), 'Independence Day');
  add(nthWeekday(y, 8, 1, 1), 'Labor Day');
  add(nthWeekday(y, 10, 4, 4), 'Thanksgiving');
  add(observed(utc(y, 11, 25)), 'Boże Narodzenie');
  return h;
}

const holidayCache = new Map<number, Map<string, string>>();
function isHoliday(d: Date): boolean {
  const y = d.getUTCFullYear();
  if (!holidayCache.has(y)) holidayCache.set(y, usHolidays(y));
  return holidayCache.get(y)!.has(ymd(d));
}
export function isBusinessDay(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !isHoliday(d);
}
/** n-ty od końca dzień roboczy miesiąca (n=1 → ostatni). */
export function nthLastBusinessDay(y: number, m: number, n: number): Date {
  let d = utc(y, m + 1, 0);
  let count = 0;
  for (;;) {
    if (isBusinessDay(d)) {
      count++;
      if (count === n) return d;
    }
    d = new Date(d.getTime() - 86400000);
  }
}
function prevBusinessDay(d: Date): Date {
  let x = new Date(d.getTime() - 86400000);
  while (!isBusinessDay(x)) x = new Date(x.getTime() - 86400000);
  return x;
}

const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTH_CODE = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
const ACTIVE = [1, 3, 5, 7, 9, 11]; // lut, kwi, cze, sie, paź, gru (0-based)

/** Daty kontraktów złota na COMEX dla miesięcy kontraktowych w oknie [from, to]. */
export function comexEvents(from: Date, to: Date): GoldCalEvent[] {
  const out: GoldCalEvent[] = [];
  for (let k = -1; k <= 14; k++) {
    const base = utc(from.getUTCFullYear(), from.getUTCMonth() + k, 1);
    const y = base.getUTCFullYear(), m = base.getUTCMonth();
    const code = `${MONTH_CODE[m]}${String(y).slice(2)}`;
    const name = `${MONTHS_PL[m]} ${y}`;
    // opcje OG: 4. od końca dzień roboczy miesiąca poprzedzającego; jeśli piątek lub dzień przed świętem → dzień wcześniej
    const pm = utc(y, m - 1, 1);
    let og = nthLastBusinessDay(pm.getUTCFullYear(), pm.getUTCMonth(), 4);
    const next = new Date(og.getTime() + 86400000);
    if (og.getUTCDay() === 5 || isHoliday(next)) og = prevBusinessDay(og);
    out.push({
      id: `og-${code}`,
      date: ymd(og),
      title: `Wygasanie opcji złota OG ${code} (${name})`,
      category: 'comex',
      venue: 'newyork',
      detail: 'Wygasanie miesięcznych opcji na kontrakt GC. Wokół dużych strike’ów często widać „przyciąganie” ceny i podwyższony wolumen.',
      url: 'https://www.cmegroup.com/markets/metals/precious/gold.contractSpecs.options.html',
    });
    if (ACTIVE.includes(m)) {
      const fnd = nthLastBusinessDay(pm.getUTCFullYear(), pm.getUTCMonth(), 1);
      const ltd = nthLastBusinessDay(y, m, 3);
      out.push({
        id: `fnd-${code}`,
        date: ymd(fnd),
        title: `First Notice Day GC ${code} (${name})`,
        category: 'comex',
        venue: 'newyork',
        detail: 'Pierwszy dzień zawiadomień o dostawie. Spekulanci zamykają/rolują pozycje wcześniej — dni przed FND to okres rolowania kontraktu frontowego.',
        url: 'https://www.cmegroup.com/markets/metals/precious/gold.calendar.html',
      });
      out.push({
        id: `ltd-${code}`,
        date: ymd(ltd),
        title: `Ostatni dzień handlu GC ${code}`,
        category: 'comex',
        venue: 'newyork',
        detail: 'Koniec handlu kontraktem dostawczym; zwykle już po rolowaniu płynności na kolejny aktywny miesiąc.',
        url: 'https://www.cmegroup.com/markets/metals/precious/gold.calendar.html',
      });
    }
  }
  const f = ymd(from), t = ymd(to);
  return out.filter((e) => e.date >= f && e.date <= t);
}

/** Cykliczne publikacje istotne dla złota. */
export function recurringEvents(from: Date, to: Date): GoldCalEvent[] {
  const out: GoldCalEvent[] = [];
  // CFTC COT — piątek (po święcie w piątek: poniedziałek)
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() !== 5) continue;
    const pub = isHoliday(d) ? new Date(d.getTime() + 3 * 86400000) : d;
    out.push({
      id: `cot-${ymd(pub)}`,
      date: ymd(pub),
      title: 'Raport CFTC COT (dane z wtorku)',
      category: 'data',
      venue: 'newyork',
      detail: 'Pozycjonowanie funduszy (Managed Money) w kontraktach na złoto. Publikacja 15:30 ET.',
      url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
    });
  }
  // rezerwy PBoC — ok. 7. dnia miesiąca; WGC Gold Demand Trends — ostatni czwartek miesiąca po kwartale
  for (let k = 0; k <= 4; k++) {
    const b = utc(from.getUTCFullYear(), from.getUTCMonth() + k, 1);
    const y = b.getUTCFullYear(), m = b.getUTCMonth();
    out.push({
      id: `pboc-${y}-${m}`,
      date: ymd(utc(y, m, 7)),
      title: 'Rezerwy walutowe i złota PBoC (dane za poprzedni miesiąc)',
      category: 'data',
      venue: 'shanghai',
      detail: 'Oficjalne zakupy złota przez bank centralny Chin — jeden z głównych filarów popytu. Publikacja zwykle ok. 7. dnia miesiąca.',
      approx: true,
      url: 'https://www.safe.gov.cn/en/',
    });
    if ([0, 3, 6, 9].includes(m)) {
      out.push({
        id: `gdt-${y}-${m}`,
        date: ymd(lastWeekday(y, m, 4)),
        title: `WGC Gold Demand Trends za Q${m === 0 ? 4 : m / 3}`,
        category: 'data',
        venue: 'london',
        detail: 'Kwartalny raport World Gold Council: popyt banków centralnych, ETF, biżuteria, sztabki i monety, podaż.',
        approx: true,
        url: 'https://www.gold.org/goldhub/research/gold-demand-trends',
      });
    }
  }
  const f = ymd(from), t = ymd(to);
  return out.filter((e) => e.date >= f && e.date <= t);
}

type BankRow = { id: string; short: string; name: string; currency: string; meetings: string[]; url: string };

export function cbEvents(from: Date, to: Date): GoldCalEvent[] {
  const out: GoldCalEvent[] = [];
  for (const b of banksJson.banks as BankRow[]) {
    for (const m of b.meetings) {
      const t = new Date(m);
      if (t < from || t > to) continue;
      out.push({
        id: `cb-${b.id}-${m}`,
        date: ymd(t),
        title: `${b.short}: decyzja w sprawie stóp`,
        category: 'cb',
        detail: `${b.name} (${b.currency}).`,
        url: b.url,
      });
    }
  }
  return out;
}

export function staticEvents(from: Date, to: Date): GoldCalEvent[] {
  const f = ymd(from), t = ymd(to);
  return (calJson.events as Omit<GoldCalEvent, 'id'>[])
    .map((e, i) => ({ ...e, id: `s-${i}-${e.date}` }))
    .filter((e) => (e.endDate ?? e.date) >= f && e.date <= t);
}

/** Wszystkie zdarzenia strukturalne w horyzoncie `days` dni (domyślnie 60). */
export function goldCalendar(days = 60, now = new Date()): GoldCalEvent[] {
  const from = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const to = new Date(from.getTime() + days * 86400000);
  // raport COT jest co tydzień — pokazujemy tylko najbliższy, żeby nie zaśmiecać osi czasu
  const rec = recurringEvents(from, to);
  const firstCot = rec.find((e) => e.id.startsWith('cot-'));
  const recFiltered = rec.filter((e) => !e.id.startsWith('cot-') || e === firstCot);
  return [...comexEvents(from, to), ...recFiltered, ...cbEvents(from, to), ...staticEvents(from, to)].sort(
    (a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category),
  );
}

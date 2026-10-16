/**
 * Skrót „co się zmieniło” — z danych, które aplikacja już ma:
 *  - czynniki makro: zmiana oceny względem poprzedniego odczytu serii FRED,
 *  - bilans tła: dziś vs tydzień temu (historia liczona wstecz),
 *  - oczekiwania wobec Fed, prawdopodobieństwo recesji, GPR,
 *  - regiony ryzyka: poziom dziś vs wczoraj (z tej samej serii GDELT),
 *  - chokepointy: status dziś vs migawka z poprzedniego dnia (magazyn kv),
 *  - decyzje banków z ostatnich 48 h, zakupy złota (IMF), kalendarz na 7 dni.
 */
import type { DigestData, DigestItem, Effect } from '../types';
import { getMacro, macroChanges } from './macro';
import { getBanks, getChokepoints, getGoldCalendar, getPolicyPulse, getRegions, levelOf, regionIndex } from './data';
import { getCbGold, getGpr } from './extra';
import { kvGet, kvSet } from '../kv';
import { fmtDateTime } from '../time';

const EFF: Record<Effect, string> = { TAILWIND: 'SPRZYJA', HEADWIND: 'SZKODZI', NEUTRAL: 'NEUTRALNIE' };
const tone = (e: Effect): DigestItem['tone'] => (e === 'TAILWIND' ? 'up' : e === 'HEADWIND' ? 'down' : 'muted');
const DAY = 86_400_000;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }); // RRRR-MM-DD w Warszawie

type ChokeSnap = { date: string; statuses: Record<string, string>; prev?: Record<string, string> };

/** Migawka statusów chokepointów raz na dzień (wywoływana przez scheduler). */
export async function snapshotDaily(): Promise<void> {
  const d = today();
  const snap = await kvGet<ChokeSnap>('snap:choke');
  if (snap?.date === d) return;
  const ch = await getChokepoints();
  if (ch.missing) return;
  const statuses = Object.fromEntries(ch.data.map((c) => [c.id, c.status]));
  await kvSet('snap:choke', { date: d, statuses, prev: snap?.statuses } satisfies ChokeSnap);
}

export async function getDigest(): Promise<DigestData> {
  const now = Date.now();
  const items: DigestItem[] = [];
  const [macro, changes, regions, chokes, gpr, cb] = await Promise.all([
    getMacro(),
    macroChanges(),
    getRegions(),
    getChokepoints(),
    getGpr(),
    getCbGold(),
  ]);

  /* makro */
  if (macro.missing) items.push({ group: 'makro', tone: 'warn', text: 'Brak danych FRED — tło makro, oczekiwania wobec Fed i recesja wymagają FRED_API_KEY.' });
  for (const c of changes) items.push({ group: 'makro', tone: tone(c.to), text: `${c.label}: ${EFF[c.from]} → ${EFF[c.to]} (odczyt ${c.asOf})` });
  const h = macro.history;
  if (h.length > 1) {
    const a = h.at(-1)!;
    const b = h.at(-2)!;
    if (a.net !== b.net) {
      items.push({
        group: 'makro',
        tone: a.net > b.net ? 'up' : 'down',
        text: `Bilans tła: ${a.net > 0 ? '+' : ''}${a.net} (tydzień temu ${b.net > 0 ? '+' : ''}${b.net}) — ${a.tailwinds} czynników sprzyja, ${a.headwinds} szkodzi`,
      });
    }
  }
  const fe = macro.sentiment.fedExpect;
  if (fe && fe.change4w !== null && Math.abs(fe.change4w) >= 10) {
    items.push({
      group: 'makro',
      tone: fe.change4w < 0 ? 'up' : 'down',
      text: `Oczekiwania wobec Fed w 4 tyg.: ${fe.change4w < 0 ? 'rynek dołożył' : 'rynek zdjął'} ~${Math.abs(fe.change4w)} pb obniżek (1Y − EFFR: ${fe.spread1} pb)`,
    });
  }
  const rec = macro.sentiment.recession;
  if (rec && rec.prob3mAgo !== null && Math.abs(rec.prob - rec.prob3mAgo) >= 5) {
    items.push({ group: 'makro', tone: rec.prob > rec.prob3mAgo ? 'up' : 'down', text: `Prawdopodobieństwo recesji w USA (12 mies.): ${rec.prob}% (3 mies. temu ${rec.prob3mAgo}%)` });
  }

  /* banki */
  for (const b of getBanks().data) {
    if (!b.lastDecision) continue;
    const t = Date.parse(b.lastDecision);
    if (now - t > 2 * DAY) continue;
    const changed = b.lastChange && Math.abs(Date.parse(b.lastChange.date) - t) <= 8 * DAY;
    items.push({
      group: 'banki',
      tone: changed ? (b.lastChange!.bps > 0 ? 'down' : 'up') : 'muted',
      text: changed
        ? `${b.short}: zmiana stóp ${b.lastChange!.bps > 0 ? '+' : ''}${b.lastChange!.bps} pb → ${b.rateLabel} (${fmtDateTime(t)})`
        : b.verify && !b.auto
          ? `${b.short}: decyzja ${fmtDateTime(t)} — wynik do wpisania w central-banks.json`
          : `${b.short}: decyzja ${fmtDateTime(t)} — stopy bez zmian (${b.rateLabel})`,
    });
  }

  /* ryzyko */
  if (!regions.missing) {
    for (const r of regions.data) {
      if (r.series.length < 11) continue;
      const prev = levelOf(regionIndex(r.series.slice(0, -1)));
      if (prev !== r.level && r.level !== 'UNKNOWN' && prev !== 'UNKNOWN') {
        const up = ['LOW', 'NORMAL', 'ELEVATED', 'HIGH'].indexOf(r.level) > ['LOW', 'NORMAL', 'ELEVATED', 'HIGH'].indexOf(prev);
        items.push({ group: 'ryzyko', tone: up ? 'warn' : 'muted', text: `${r.name}: ${prev} → ${r.level} (×${r.ratio?.toFixed(2)} vs śr. 30 dni)` });
      }
    }
  }
  if (gpr.data && (gpr.data.level === 'ELEVATED' || gpr.data.level === 'HIGH')) {
    items.push({ group: 'ryzyko', tone: 'warn', text: `Indeks GPR: ${gpr.data.level} — średnia 7 dni ×${gpr.data.ratio} względem roku (${gpr.data.latestDate})` });
  }
  for (const e of gpr.data?.events ?? []) {
    if (now - Date.parse(e.date) <= 7 * DAY) items.push({ group: 'ryzyko', tone: 'muted', text: `GPR odnotowuje: ${e.text} (${e.date})` });
  }

  /* chokepointy */
  const snap = await kvGet<ChokeSnap>('snap:choke');
  const base = snap?.date === today() ? snap.prev : snap?.statuses;
  if (base && !chokes.missing) {
    for (const c of chokes.data) {
      const p = base[c.id];
      if (p && p !== c.status && c.status !== 'UNKNOWN') {
        items.push({ group: 'chokepointy', tone: c.status === 'NORMAL' ? 'up' : 'warn', text: `${c.name}: ${p} → ${c.status} (${c.mentions} nagłówków w 48 h)` });
      }
    }
  }

  /* złoto: zakupy banków centralnych */
  if (cb.data) {
    const fresh = cb.data.rows.filter((r) => r.period === cb.data!.latestPeriod && r.change1m !== null);
    const top = [...fresh].sort((a, b) => (b.change1m as number) - (a.change1m as number))[0];
    items.push({
      group: 'złoto',
      tone: cb.data.netLastMonth >= 0 ? 'up' : 'down',
      text: `Banki centralne (IMF, ${cb.data.latestPeriod}): netto ${cb.data.netLastMonth > 0 ? '+' : ''}${cb.data.netLastMonth} t${top && (top.change1m as number) > 0 ? `; najwięcej ${top.name} +${top.change1m} t` : ''}`,
    });
  }

  /* kalendarz 7 dni */
  const upcoming: DigestData['upcoming'] = [];
  const pulse = getPolicyPulse().data;
  for (const u of pulse.upcoming) if (u.time - now <= 7 * DAY) upcoming.push({ date: new Date(u.time).toISOString().slice(0, 10), text: `${u.short}: decyzja (${fmtDateTime(u.time)})`, kind: 'cb' });
  for (const e of getGoldCalendar(8).data) if (e.category !== 'cb') upcoming.push({ date: e.date, text: e.title, kind: 'gold' });
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const headline = macro.missing ? `Cykl banków: ${pulse.label}.` : `${macro.summary} Cykl banków: ${pulse.label}.`;
  return { generatedAt: now, headline, items, upcoming: upcoming.slice(0, 12), basis: 'Makro: od poprzedniego odczytu serii; regiony i chokepointy: od wczoraj; banki: ostatnie 48 h.' };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ICON: Record<DigestItem['tone'], string> = { up: '🟢', down: '🔴', warn: '🟠', muted: '▫️' };

export function digestTelegram(d: DigestData): string {
  const lines = [`☀️ <b>AURUM — skrót dnia</b>`, esc(d.headline), ''];
  if (d.items.length) {
    lines.push('<b>Co się zmieniło</b>');
    for (const i of d.items.slice(0, 15)) lines.push(`${ICON[i.tone]} ${esc(i.text)}`);
  } else lines.push('Bez istotnych zmian w tle od wczoraj.');
  if (d.upcoming.length) {
    lines.push('', '<b>Najbliższe 7 dni</b>');
    for (const u of d.upcoming.slice(0, 10)) lines.push(`• ${u.date.slice(8, 10)}.${u.date.slice(5, 7)} ${esc(u.text)}`);
  }
  return lines.join('\n');
}

/**
 * Alerty Telegram (opcjonalne) — wyłącznie zdarzenia „tła”, których nie obsługuje GOLD DESK:
 *  - region geopolityczny przechodzi na poziom HIGH,
 *  - chokepoint zmienia status na DISRUPTED,
 *  - przypomnienie dzień przed decyzją banku centralnego spoza USD (opcjonalnie),
 *  - zmiana znaku bilansu tła makro (przewaga czynników sprzyjających ↔ szkodzących),
 *  - poranny skrót „co się zmieniło” o godzinie DIGEST_HOUR (czas warszawski).
 * Wymaga TELEGRAM_BOT_TOKEN i TELEGRAM_CHAT_ID w .env.
 */
import { getBanks, getChokepoints, getRegions } from './data';
import { getMacro } from './macro';
import { digestTelegram, getDigest } from './digest';
import { kvGet, kvSet } from '../kv';
import { fmtDateTime } from '../time';

interface AlertState {
  regionLevel: Map<string, string>;
  chokeStatus: Map<string, string>;
  cbReminded: Set<string>;
  log: { at: number; text: string; ok: boolean }[];
}
const g = globalThis as unknown as { __alerts?: AlertState };
const st: AlertState = g.__alerts ?? (g.__alerts = { regionLevel: new Map(), chokeStatus: new Map(), cbReminded: new Set(), log: [] });

const CB_REMINDER = process.env.ALERT_CB_REMINDER !== 'false';
const MACRO_FLIP = process.env.ALERT_MACRO_FLIP !== 'false';
const DIGEST_ON = process.env.DIGEST_ENABLED !== 'false';
const DIGEST_HOUR = Math.min(23, Math.max(0, Number(process.env.DIGEST_HOUR ?? 8) || 8));

function warsawNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Poranny skrót: raz dziennie, po godzinie DIGEST_HOUR (Warszawa). Stan „wysłano” w magazynie kv — przetrwa restart. */
export async function maybeSendDigest(force = false): Promise<boolean> {
  if (!telegramConfigured() || (!DIGEST_ON && !force)) return false;
  const { date, hour } = warsawNow();
  if (!force) {
    if (hour < DIGEST_HOUR) return false;
    if ((await kvGet<string>('digest:sent')) === date) return false;
  }
  const ok = await sendTelegram(digestTelegram(await getDigest()));
  if (ok && !force) await kvSet('digest:sent', date);
  return ok;
}

/** Telegram parse_mode=HTML: tekst z zewnątrz (nagłówki GDELT, nazwy) musi być escapowany, inaczej API zwraca 400. */
const esc = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function telegramConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text: string): Promise<boolean> {
  if (!telegramConfigured()) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const why = res.ok ? '' : `\n[Telegram ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}]`;
    if (!res.ok) console.warn(`[alerts] Telegram ${res.status}`);
    st.log.unshift({ at: Date.now(), text: text + why, ok: res.ok });
    st.log.length = Math.min(st.log.length, 30);
    return res.ok;
  } catch (e) {
    st.log.unshift({ at: Date.now(), text: `${text}\n[błąd: ${String(e)}]`, ok: false });
    return false;
  }
}

export async function checkAlerts(): Promise<string[]> {
  const fired: string[] = [];
  if (!telegramConfigured()) return fired;

  const regions = await getRegions();
  if (!regions.missing) {
    for (const r of regions.data) {
      const prev = st.regionLevel.get(r.id);
      st.regionLevel.set(r.id, r.level);
      if (prev && prev !== 'HIGH' && r.level === 'HIGH') {
        const ok = await sendTelegram(
          `🌍 <b>AURUM — ryzyko: ${esc(r.name)} → HIGH</b>\nIntensywność relacji ×${r.ratio?.toFixed(2)} względem średniej z 30 dni.\n🟡 ${esc(r.gold)}`,
        );
        if (ok) fired.push(`region:${r.id}`);
      }
    }
  }

  const chokes = await getChokepoints();
  if (!chokes.missing) {
    for (const c of chokes.data) {
      const prev = st.chokeStatus.get(c.id);
      st.chokeStatus.set(c.id, c.status);
      if (prev && prev !== 'DISRUPTED' && c.status === 'DISRUPTED') {
        const top = c.headlines.slice(0, 2).map((h) => `• ${esc(h.title)}`).join('\n');
        const ok = await sendTelegram(`⚓ <b>AURUM — ${esc(c.name)}: ZAKŁÓCENIA</b>\n${c.mentions} nagłówków o zakłóceniach w 48h.\n${top}\n🟡 Ropa ↑ → oczekiwania inflacyjne ↑ → wsparcie dla złota.`);
        if (ok) fired.push(`choke:${c.id}`);
      }
    }
  }

  if (MACRO_FLIP) {
    const m = await getMacro();
    if (!m.missing && !m.pending) {
      const sign = Math.sign(m.tailwinds - m.headwinds);
      const prev = await kvGet<number>('alert:macroSign');
      if (prev !== sign) await kvSet('alert:macroSign', sign);
      if (prev !== null && prev !== sign && sign !== 0) {
        const ok = await sendTelegram(
          `${sign > 0 ? '🟢' : '🔴'} <b>AURUM — tło makro ${sign > 0 ? 'przechyliło się na korzyść złota' : 'przestało sprzyjać złotu'}</b>\n${esc(m.summary)}\n` +
            m.factors
              .filter((f) => !f.missing && f.effect !== 'NEUTRAL')
              .map((f) => `${f.effect === 'TAILWIND' ? '▲' : '▼'} ${esc(f.label)}: ${esc(f.changeLabel)} / ${esc(f.horizon)}`)
              .join('\n'),
        );
        if (ok) fired.push('macro:flip');
      }
    }
  }

  if (await maybeSendDigest()) fired.push('digest');

  if (CB_REMINDER) {
    const now = Date.now();
    for (const b of getBanks().data) {
      if (!b.nextDecision || b.currency === 'USD') continue;
      const t = Date.parse(b.nextDecision);
      const hours = (t - now) / 3600000;
      const key = `${b.id}:${b.nextDecision}`;
      if (hours > 0 && hours <= 24 && !st.cbReminded.has(key)) {
        st.cbReminded.add(key);
        const ok = await sendTelegram(`🏛 <b>AURUM — decyzja ${esc(b.short)} za ${Math.max(1, Math.round(hours))} h</b>\n${esc(b.name)} · ${fmtDateTime(t)} (Warszawa)\nObecnie: ${esc(b.rateLabel)}`);
        if (ok) fired.push(`cb:${b.id}`);
      }
    }
  }
  return fired;
}

export function alertStatus() {
  return {
    enabled: telegramConfigured(),
    cbReminder: CB_REMINDER,
    macroFlip: MACRO_FLIP,
    digest: DIGEST_ON ? `codziennie po ${DIGEST_HOUR}:00 (Warszawa)` : 'wyłączony',
    regionLevels: Object.fromEntries(st.regionLevel),
    chokeStatus: Object.fromEntries(st.chokeStatus),
    log: st.log.map((l) => ({ ...l, text: l.text.replace(/<[^>]+>/g, '') })),
  };
}

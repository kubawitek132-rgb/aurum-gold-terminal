'use client';

import type { CbGoldData, DigestData, GprData, MacroHistoryPoint, ReactionsData, Sentiment, SourceResult } from '@/lib/types';
import { LEVEL_COLOR, LEVEL_LABEL } from '@/lib/layers';
import { fmtAgo } from '@/lib/time';
import { Freshness, Panel, Sparkline } from './ui';

const TONE_CLS = { up: 'text-up', down: 'text-down', warn: 'text-warn', muted: 'text-slate-300' } as const;
const TONE_DOT = { up: '#22c55e', down: '#ef4444', warn: '#f59e0b', muted: '#64748b' } as const;
const GROUP_LABEL: Record<string, string> = { makro: 'MAKRO', banki: 'BANKI', ryzyko: 'RYZYKO', chokepointy: 'ŻEGLUGA', 'złoto': 'ZŁOTO' };
const signed = (v: number, d = 2) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/* ───────────── CO SIĘ ZMIENIŁO ───────────── */
export function DigestPanel({ digest, now }: { digest: DigestData | null; now: number }) {
  return (
    <Panel title="CO SIĘ ZMIENIŁO" accent="#22d3ee" right={digest && <span className="text-[9px] text-muted">{fmtAgo(digest.generatedAt, now)}</span>}>
      {!digest ? (
        <div className="text-[10px] text-muted">ładowanie…</div>
      ) : (
        <>
          <p className="mb-2 text-[10.5px] leading-relaxed text-slate-200">{digest.headline}</p>
          {digest.items.length ? (
            <ul className="space-y-1">
              {digest.items.map((i, k) => (
                <li key={k} className="flex gap-2 text-[10.5px] leading-snug">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_DOT[i.tone] }} />
                  <span className="w-[52px] shrink-0 text-[8.5px] font-bold tracking-wider text-muted">{GROUP_LABEL[i.group] ?? i.group}</span>
                  <span className={TONE_CLS[i.tone]}>{i.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[10px] text-muted">Bez istotnych zmian w tle od wczoraj.</div>
          )}
          {digest.upcoming.length > 0 && (
            <>
              <div className="mt-2 text-[9px] tracking-[0.15em] text-muted">NAJBLIŻSZE 7 DNI</div>
              <ul className="mt-1 space-y-0.5">
                {digest.upcoming.map((u, k) => (
                  <li key={k} className="flex gap-2 text-[10px]">
                    <span className="w-9 shrink-0 tabular-nums text-slate-400">{dm(u.date)}</span>
                    <span className={u.kind === 'cb' ? 'text-gold' : 'text-slate-300'}>{u.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-1 text-[9px] text-muted">{digest.basis} Ten sam skrót rano na Telegramie.</div>
        </>
      )}
    </Panel>
  );
}

/* ───────────── HISTORIA BILANSU TŁA ───────────── */
export function MacroHistoryChart({ history }: { history: MacroHistoryPoint[] }) {
  if (history.length < 2) return null;
  const W = 300;
  const Hh = 56;
  const mid = Hh / 2;
  const max = Math.max(3, ...history.map((p) => Math.abs(p.net)));
  const bw = W / history.length;
  const last = history.at(-1)!;
  const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-[9px] tracking-[0.15em] text-muted">
        <span>BILANS TŁA · 52 TYG.</span>
        <span className="tabular-nums">
          teraz <span className={last.net > 0 ? 'text-up' : last.net < 0 ? 'text-down' : 'text-slate-300'}>{sign(last.net)}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-1 w-full" role="img" aria-label="Bilans czynników makro tydzień po tygodniu">
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="#1a2230" />
        {history.map((p, i) => {
          const h = (Math.abs(p.net) / max) * (mid - 2);
          return (
            <rect key={p.date} x={i * bw + 0.5} y={p.net >= 0 ? mid - h : mid} width={Math.max(1, bw - 1)} height={Math.max(p.net ? 1 : 0, h)} fill={p.net >= 0 ? '#22c55e' : '#ef4444'} opacity={i === history.length - 1 ? 1 : 0.6}>
              <title>{`${p.date}: ${p.tailwinds} sprzyja, ${p.headwinds} szkodzi (bilans ${sign(p.net)})`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[8.5px] tabular-nums text-muted">
        <span>{dm(history[0].date)}.{history[0].date.slice(2, 4)}</span>
        <span>liczone wstecz tymi samymi regułami</span>
        <span>{dm(last.date)}</span>
      </div>
    </div>
  );
}

/* ───────────── SENTYMENT: OCZEKIWANIA FED, VIX, RECESJA ───────────── */
export function SentimentBlock({ s }: { s: Sentiment | undefined }) {
  if (!s || (!s.fedExpect && !s.vix && !s.recession)) return null;
  const fe = s.fedExpect;
  const rec = s.recession;
  return (
    <div className="mt-2 grid grid-cols-3 gap-1 text-[9.5px]">
      <div className="border border-line px-1.5 py-1" title={fe ? `${fe.label}. 1Y ${fe.y1.toFixed(2)}%, 2Y ${fe.y2.toFixed(2)}%, EFFR ${fe.effr.toFixed(2)}% (${fe.asOf})` : ''}>
        <div className="text-[8.5px] tracking-wider text-muted">FED: 1Y − EFFR</div>
        {fe ? (
          <>
            <div className={`text-[13px] font-bold tabular-nums ${fe.spread1 <= -15 ? 'text-up' : fe.spread1 >= 15 ? 'text-down' : 'text-slate-200'}`}>{signed(fe.spread1, 0)} pb</div>
            <div className="text-muted">{fe.change4w === null ? '—' : `${signed(fe.change4w, 0)} pb / 4 tyg.`}</div>
          </>
        ) : (
          <div className="text-muted">brak danych</div>
        )}
      </div>
      <div className="border border-line px-1.5 py-1" title="Indeks zmienności S&P 500 (FRED: VIXCLS)">
        <div className="text-[8.5px] tracking-wider text-muted">VIX</div>
        {s.vix ? (
          <>
            <div className={`text-[13px] font-bold tabular-nums ${s.vix.value >= 25 ? 'text-warn' : 'text-slate-200'}`}>{s.vix.value.toFixed(1)}</div>
            <div className="text-muted">{s.vix.change4w === null ? '—' : `${signed(s.vix.change4w, 1)} / 4 tyg.`}</div>
          </>
        ) : (
          <div className="text-muted">brak danych</div>
        )}
      </div>
      <div className="border border-line px-1.5 py-1" title={rec ? `Model NY Fed (probit na spreadzie 10Y–3M = ${rec.spread} pp), obliczenie własne, stan ${rec.asOf}` : ''}>
        <div className="text-[8.5px] tracking-wider text-muted">RECESJA 12M</div>
        {rec ? (
          <>
            <div className={`text-[13px] font-bold tabular-nums ${rec.prob >= 40 ? 'text-warn' : 'text-slate-200'}`}>{rec.prob.toFixed(0)}%</div>
            <div className="text-muted">{rec.prob3mAgo === null ? '—' : `3 mies. temu ${rec.prob3mAgo.toFixed(0)}%`}</div>
          </>
        ) : (
          <div className="text-muted">brak danych</div>
        )}
      </div>
      {fe && <div className="col-span-3 text-[9.5px] leading-snug text-slate-300">{fe.label}. Wyższa wycena obniżek zwykle sprzyja złotu.</div>}
    </div>
  );
}

/* ───────────── GPR ───────────── */
export function GprBlock({ gpr, now }: { gpr: SourceResult<GprData | null> | null; now: number }) {
  const g = gpr?.data;
  if (!gpr) return null;
  return (
    <div className="mb-2 border-b border-line/70 pb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] tracking-[0.15em] text-muted" title="Geopolitical Risk Index — Caldara & Iacoviello (Federal Reserve Board), dzienny">
          INDEKS GPR (CALDARA–IACOVIELLO)
        </span>
        <Freshness stale={gpr.stale} missing={gpr.missing} updatedAt={gpr.updatedAt} now={now} />
      </div>
      {!g ? (
        <div className="text-[10px] text-muted">{gpr.source}</div>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-[68px] shrink-0 border px-1 text-center text-[8.5px] font-bold" style={{ color: LEVEL_COLOR[g.level], borderColor: LEVEL_COLOR[g.level] + '88' }}>
              {LEVEL_LABEL[g.level]}
            </span>
            <span className="min-w-0 flex-1 text-[9.5px] tabular-nums text-slate-300">
              {g.latest} ({dm(g.latestDate)}) · śr. 7 dni ×{g.ratio} vs rok
            </span>
            <Sparkline values={g.series} width={74} height={22} color={LEVEL_COLOR[g.level]} />
          </div>
          {g.events.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {g.events.slice(0, 3).map((e) => (
                <li key={e.date + e.text} className="truncate text-[9.5px] text-slate-400" title={e.text}>
                  <span className="tabular-nums text-muted">{dm(e.date)}</span> {e.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── ZAKUPY BANKÓW CENTRALNYCH (IMF) ───────────── */
export function CbGoldPanel({ cb, now }: { cb: SourceResult<CbGoldData | null> | null; now: number }) {
  const d = cb?.data;
  const rows = d ? [...d.rows].filter((r) => r.change12m !== null).sort((a, b) => (b.change12m as number) - (a.change12m as number)) : [];
  const top = rows.filter((r) => Math.abs(r.change12m as number) >= 1).slice(0, 12);
  return (
    <Panel title="ZAKUPY ZŁOTA · BANKI CENTRALNE" accent="#facc15" right={cb && <Freshness stale={cb.stale} missing={cb.missing} updatedAt={cb.updatedAt} now={now} />}>
      {!d ? (
        <div className="text-[10px] text-muted">{cb?.source ?? 'ładowanie…'}</div>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap gap-x-3 text-[10px]">
            <span>
              {d.latestPeriod}: netto{' '}
              <span className={d.netLastMonth >= 0 ? 'text-up' : 'text-down'}>
                {signed(d.netLastMonth, 1)} t
              </span>
            </span>
            <span className="text-muted">
              kupuje {d.buyers} · sprzedaje {d.sellers}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_52px_48px_48px_44px] gap-x-1 text-[8.5px] tracking-wider text-muted">
            <span>KRAJ</span>
            <span className="text-right">TONY</span>
            <span className="text-right">M/M</span>
            <span className="text-right">12 MIES.</span>
            <span />
          </div>
          <ul>
            {top.map((r) => (
              <li key={r.iso3} className="grid grid-cols-[1fr_52px_48px_48px_44px] items-center gap-x-1 text-[10px] tabular-nums" title={`stan na ${r.period}`}>
                <span className="truncate text-slate-300">{r.name}</span>
                <span className="text-right text-slate-400">{Math.round(r.tonnes).toLocaleString('pl-PL')}</span>
                <span className={`text-right ${r.change1m === null ? 'text-muted' : r.change1m > 0.4 ? 'text-up' : r.change1m < -0.4 ? 'text-down' : 'text-slate-400'}`}>
                  {r.change1m === null ? '—' : signed(r.change1m, 1)}
                </span>
                <span className={`text-right ${(r.change12m as number) > 0 ? 'text-up' : 'text-down'}`}>{signed(r.change12m as number, 0)}</span>
                <Sparkline values={r.history} width={44} height={14} color={(r.change12m as number) >= 0 ? '#facc15' : '#ef4444'} />
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[9px] text-muted">IMF IRFCL, miesięcznie (opóźnienie ok. 1–2 mies.). Bez m.in. Kanady, ZEA, Kataru. Rosja nie raportuje.</div>
        </>
      )}
    </Panel>
  );
}

/* ───────────── REAKCJE ZŁOTA NA ZDARZENIA ───────────── */
export function ReactionsPanel({ r, now }: { r: SourceResult<ReactionsData | null> | null; now: number }) {
  const d = r?.data;
  const cls = (v: number) => (v > 0.05 ? 'text-up' : v < -0.05 ? 'text-down' : 'text-slate-400');
  return (
    <Panel title="REAKCJA ZŁOTA NA ZDARZENIA" accent="#22d3ee" defaultOpen={false} right={r && <Freshness stale={r.stale} missing={r.missing} updatedAt={r.updatedAt} now={now} />}>
      {!d ? (
        <div className="text-[10px] text-muted">{r?.source ?? 'ładowanie…'}</div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_28px_46px_36px_46px] gap-x-1 text-[8.5px] tracking-wider text-muted">
            <span>ZDARZENIE</span>
            <span className="text-right">N</span>
            <span className="text-right">DZIEŃ</span>
            <span className="text-right">↑%</span>
            <span className="text-right">+5 SES.</span>
          </div>
          <ul>
            {d.stats.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_28px_46px_36px_46px] gap-x-1 text-[10px] tabular-nums" title={`${s.note} Mediana dnia: ${signed(s.median0)}%. Ostatnio: ${s.last ?? '—'}.`}>
                <span className="truncate text-slate-300">{s.label}</span>
                <span className="text-right text-muted">{s.n}</span>
                <span className={`text-right ${cls(s.avg0)}`}>{signed(s.avg0)}%</span>
                <span className="text-right text-slate-400">{s.up0}</span>
                <span className={`text-right ${cls(s.avg5)}`}>{signed(s.avg5)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[9px] text-muted">
            Średni ruch XAU/USD (zamknięcie do zamknięcia) w dniu zdarzenia i do 5 sesji po; {d.from.slice(0, 4)}–{d.to.slice(0, 4)}. Statystyka historyczna, nie prognoza.
          </div>
        </>
      )}
    </Panel>
  );
}

'use client';

import type { CbGoldData, DigestData, GoldCalEvent, GprData, HubsData, MacroData, PolicyPulse, ReactionsData, RegionRisk, SeasonalityData, SourceResult, StatusData } from '@/lib/types';
import { fmtAgo, fmtCountdown, fmtDateTime } from '@/lib/time';
import { CAT_COLOR, CAT_LABEL, EFFECT_COLOR, EFFECT_LABEL, LEVEL_COLOR, LEVEL_LABEL, STANCE_COLOR } from '@/lib/layers';
import { Freshness, Panel, Sparkline } from './ui';
import { CbGoldPanel, DigestPanel, GprBlock, MacroHistoryChart, ReactionsPanel, SentimentBlock } from './Panels2';

const MONTHS = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];

/* ───────────── TŁO MAKRO ───────────── */
function Macro({ macro, now }: { macro: MacroData | null; now: number }) {
  return (
    <Panel title="TŁO MAKRO · TYGODNIE" accent="#D4AF37" right={macro && <Freshness stale={macro.stale} missing={macro.missing} updatedAt={macro.computedAt} now={now} />}>
      {!macro ? (
        <div className="text-[10px] text-muted">ładowanie…</div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-2 flex-1 overflow-hidden bg-line">
              <div className="bg-up" style={{ width: `${(macro.tailwinds / macro.factors.length) * 100}%` }} />
              <div className="bg-slate-500" style={{ width: `${(macro.neutral / macro.factors.length) * 100}%` }} />
              <div className="bg-down" style={{ width: `${(macro.headwinds / macro.factors.length) * 100}%` }} />
            </div>
            <span className="text-[10px] tabular-nums">
              <span className="text-up">{macro.tailwinds}</span>/<span className="text-slate-400">{macro.neutral}</span>/<span className="text-down">{macro.headwinds}</span>
            </span>
          </div>
          <p className="mb-2 text-[10.5px] text-slate-300">{macro.summary}</p>
          <ul className="space-y-1.5">
            {macro.factors.map((f) => (
              <li key={f.id} title={f.rule} className={f.missing ? 'opacity-60' : ''}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] text-slate-200">{f.label}</div>
                    <div className="text-[9.5px] tabular-nums text-muted">
                      {f.valueLabel} · {f.changeLabel} / {f.horizon}
                    </div>
                  </div>
                  <Sparkline values={f.history} width={70} height={22} color={EFFECT_COLOR[f.effect]} />
                  <span
                    className="w-[74px] shrink-0 border px-1 text-center text-[8.5px] font-bold tracking-wider"
                    style={{ color: EFFECT_COLOR[f.effect], borderColor: EFFECT_COLOR[f.effect] + '88' }}
                  >
                    {EFFECT_LABEL[f.effect]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <SentimentBlock s={macro.sentiment} />
          <MacroHistoryChart history={macro.history ?? []} />
          <div className="mt-2 text-[9px] uppercase tracking-wider text-warn">kontekst, nie sygnał · reguły w podpowiedziach</div>
        </>
      )}
    </Panel>
  );
}

/* ───────────── PULS BANKÓW ───────────── */
function Pulse({ pulse, now, onPick }: { pulse: SourceResult<PolicyPulse> | null; now: number; onPick: (bankId: string) => void }) {
  const p = pulse?.data;
  return (
    <Panel title="PULS BANKÓW CENTRALNYCH" accent="#f59e0b" right={pulse && <Freshness stale={pulse.stale} updatedAt={pulse.updatedAt} now={now} />}>
      {!p ? (
        <div className="text-[10px] text-muted">ładowanie…</div>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className={`text-[16px] font-bold ${p.label === 'ZACIEŚNIANIE' ? 'text-down' : p.label === 'LUZOWANIE' ? 'text-up' : 'text-slate-200'}`}>{p.label}</span>
            <span className="text-[10px] text-muted">ostatnie {p.windowDays} dni</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[9.5px]">
            {p.hikes.map((h) => (
              <span key={h.short} className="border border-down/50 px-1 text-down" title={`${h.date}`}>
                {h.short} +{h.bps}
              </span>
            ))}
            {p.cuts.map((h) => (
              <span key={h.short} className="border border-up/50 px-1 text-up" title={`${h.date}`}>
                {h.short} {h.bps}
              </span>
            ))}
            {p.holds.map((s) => (
              <span key={s} className="border border-line px-1 text-slate-400">
                {s} ■
              </span>
            ))}
            {p.unknown.map((s) => (
              <span key={s} className="border border-dashed border-line px-1 text-muted" title="brak daty ostatniej zmiany w JSON">
                {s} ?
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{p.note}</p>
          {p.fedExpect && (
            <div className="mt-1 text-[10px] text-slate-300" title={`1Y − EFFR: ${p.fedExpect.spread1} pb · 2Y − EFFR: ${p.fedExpect.spread2} pb (${p.fedExpect.asOf})`}>
              Fed: <span className={p.fedExpect.spread1 <= -15 ? 'text-up' : p.fedExpect.spread1 >= 15 ? 'text-down' : ''}>{p.fedExpect.label}</span>
            </div>
          )}
          {p.buyers.length > 0 && (
            <div className="mt-1 text-[10px] text-slate-400">
              Kupujący złoto: <span className="text-gold">{p.buyers.join(', ')}</span>
            </div>
          )}
          <div className="mt-2 text-[9px] tracking-[0.15em] text-muted">DECYZJE · 30 DNI</div>
          <ul className="mt-1 space-y-0.5">
            {p.upcoming.map((u) => (
              <li key={u.id}>
                <button onClick={() => onPick(u.id)} className="flex w-full items-center gap-2 px-1 py-0.5 text-left text-[10.5px] hover:bg-white/[0.03]">
                  <span className="h-2 w-2 shrink-0" style={{ background: STANCE_COLOR[u.stance] }} />
                  <span className="w-11 shrink-0 font-bold text-slate-200">{u.short}</span>
                  <span className="flex-1 truncate text-slate-400">{u.rateLabel}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block text-[9px] text-muted">{fmtDateTime(u.time)}</span>
                    <span className="text-data">{fmtCountdown(u.time - now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ───────────── RYZYKO REGIONÓW ───────────── */
function Regions({ regions, gpr, now, onPick }: { regions: SourceResult<RegionRisk[]> | null; gpr: SourceResult<GprData | null> | null; now: number; onPick: (r: RegionRisk) => void }) {
  const list = [...(regions?.data ?? [])].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  return (
    <Panel title="RYZYKO GEOPOLITYCZNE · REGIONY" accent="#f43f5e" right={regions && <Freshness stale={regions.stale} missing={regions.missing} updatedAt={regions.updatedAt} now={now} />}>
      <GprBlock gpr={gpr} now={now} />
      <div className="mb-1 text-[9px] tracking-[0.15em] text-muted">REGIONY (GDELT)</div>
      <ul className="space-y-1">
        {list.map((r) => (
          <li key={r.id}>
            <button onClick={() => onPick(r)} className="flex w-full items-center gap-2 px-1 py-0.5 text-left hover:bg-white/[0.03]">
              <span className="w-[68px] shrink-0 border px-1 text-center text-[8.5px] font-bold" style={{ color: LEVEL_COLOR[r.level], borderColor: LEVEL_COLOR[r.level] + '88' }}>
                {LEVEL_LABEL[r.level]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] text-slate-200">{r.name}</span>
                <span className="text-[9px] tabular-nums text-muted">×{r.ratio?.toFixed(2) ?? '—'} vs śr. 30 dni</span>
              </span>
              <Sparkline values={r.series} width={74} height={22} color={LEVEL_COLOR[r.level]} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[9px] text-muted">Intensywność relacji medialnych (GDELT): ostatnie 3 dni względem średniej z 30 dni.</div>
    </Panel>
  );
}

/* ───────────── KALENDARZ ZŁOTA ───────────── */
function GoldCal({ cal, onPick }: { cal: SourceResult<GoldCalEvent[]> | null; onPick: (e: GoldCalEvent) => void }) {
  const list = (cal?.data ?? []).filter((e) => e.category !== 'cb').slice(0, 16);
  return (
    <Panel title="KALENDARZ STRUKTURALNY ZŁOTA" accent="#22d3ee">
      <ul className="space-y-1">
        {list.map((e) => (
          <li key={e.id}>
            <button onClick={() => onPick(e)} className="flex w-full gap-2 px-1 py-0.5 text-left hover:bg-white/[0.03]" title={e.detail}>
              <span className="w-[54px] shrink-0 text-[9.5px] tabular-nums text-slate-400">
                {new Date(e.date + 'T12:00:00Z').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                {e.endDate ? '→' : ''}
              </span>
              <span className="w-[50px] shrink-0 text-[8.5px] font-bold tracking-wider" style={{ color: CAT_COLOR[e.category] }}>
                {CAT_LABEL[e.category]}
              </span>
              <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-slate-200">
                {e.title}
                {e.approx && <span className="ml-1 text-[9px] text-muted">(szac.)</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[9px] text-muted">Daty COMEX wg reguł CME (opcje OG, First Notice Day, ostatni dzień handlu). Decyzje banków — w panelu wyżej.</div>
    </Panel>
  );
}

/* ───────────── SEZONOWOŚĆ ───────────── */
function Season({ season }: { season: SourceResult<SeasonalityData | null> | null }) {
  const s = season?.data;
  const max = s ? Math.max(...s.months.map((m) => Math.abs(m.avg)), 0.5) : 1;
  return (
    <Panel title="SEZONOWOŚĆ XAUUSD" accent="#D4AF37" defaultOpen={!!s}>
      {!s ? (
        <div className="text-[10px] text-muted">{season?.source ?? 'ładowanie…'}</div>
      ) : (
        <>
          <svg viewBox="0 0 300 110" className="w-full" role="img" aria-label="Średnia miesięczna zmiana ceny złota">
            <line x1="0" y1="50" x2="300" y2="50" stroke="#1a2230" />
            {s.months.map((m, i) => {
              const h = (Math.abs(m.avg) / max) * 44;
              const x = i * 25 + 3;
              const cur = i === s.currentMonth;
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={m.avg >= 0 ? 50 - h : 50}
                    width={19}
                    height={Math.max(1, h)}
                    fill={m.avg >= 0 ? '#22c55e' : '#ef4444'}
                    opacity={cur ? 1 : 0.55}
                    stroke={cur ? '#D4AF37' : 'none'}
                  >
                    <title>{`${MONTHS[i]}: średnio ${m.avg > 0 ? '+' : ''}${m.avg}% · mediana ${m.median}% · wzrost w ${m.positive}% lat (n=${m.n})`}</title>
                  </rect>
                  <text x={x + 9.5} y={106} fontSize="7" textAnchor="middle" fill={cur ? '#D4AF37' : '#6b7a90'}>
                    {MONTHS[i]}
                  </text>
                  <text x={x + 9.5} y={m.avg >= 0 ? 50 - h - 2 : 50 + h + 8} fontSize="6.5" textAnchor="middle" fill="#94a3b8">
                    {m.avg > 0 ? '+' : ''}
                    {m.avg.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="text-[10px] text-slate-300">
            {MONTHS[s.currentMonth]}: średnio {s.months[s.currentMonth].avg > 0 ? '+' : ''}
            {s.months[s.currentMonth].avg}%, wzrost w {s.months[s.currentMonth].positive}% lat.
          </div>
          <div className="text-[9px] text-muted">Średnie zmiany miesięczne {s.years}. Historia nie gwarantuje powtórki.</div>
        </>
      )}
    </Panel>
  );
}

/* ───────────── REZERWY ───────────── */
function Reserves({ hubs, onShow }: { hubs: HubsData | null; onShow: () => void }) {
  const list = [...(hubs?.reserves ?? [])].sort((a, b) => b.tonnes - a.tonnes).slice(0, 15);
  const max = list[0]?.tonnes ?? 1;
  return (
    <Panel title="OFICJALNE REZERWY ZŁOTA" accent="#facc15" defaultOpen={false} right={<button onClick={onShow} className="text-[9px] text-data">NA MAPIE →</button>}>
      <ul className="space-y-0.5">
        {list.map((r) => (
          <li key={r.iso} className="flex items-center gap-2 text-[10px]">
            <span className="w-[92px] shrink-0 truncate text-slate-300">{r.name}</span>
            <span className="relative h-2 flex-1 bg-line">
              <span className="absolute inset-y-0 left-0" style={{ width: `${(r.tonnes / max) * 100}%`, background: r.trend === 'buying' ? '#facc15' : '#8a7224' }} />
            </span>
            <span className="w-[52px] shrink-0 text-right tabular-nums text-slate-400">{r.tonnes.toLocaleString('pl-PL')} t</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 text-[9px] text-muted">Jaśniejszy pasek = kraj kupujący. {hubs?.reservesAsOf}.</div>
    </Panel>
  );
}

/* ───────────── STATUS ŹRÓDEŁ ───────────── */
const KEY_LABEL: Record<string, string> = {
  calendar: 'Kalendarz (ForexFactory)',
  'gdelt:geo': 'GDELT — zdarzenia 24h',
  'gdelt:choke': 'GDELT — chokepointy',
  'gdelt:regions': 'GDELT — regiony ryzyka',
  'td:xau:monthly': 'Twelve Data — sezonowość',
};
const keyLabel = (k: string) => KEY_LABEL[k] ?? (k.startsWith('fred:') ? `FRED ${k.slice(5)}` : k);

function Status({ status, now }: { status: StatusData | null; now: number }) {
  const cfg = status?.config;
  const chips: [string, boolean | undefined, string][] = [
    ['FRED', cfg?.fred, 'tło makro i pasek MACRO'],
    ['TWELVE DATA', cfg?.twelvedataSeasonality, 'sezonowość'],
    ['AIS', cfg?.aisstream, 'statki w chokepointach'],
    ['TELEGRAM', cfg?.telegram, 'alerty'],
    ['REDIS', cfg?.redis, 'cache po restarcie'],
  ];
  const bad = status?.sources.filter((x) => x.missing || x.stale).length ?? 0;
  return (
    <Panel
      title="STATUS ŹRÓDEŁ"
      accent="#94a3b8"
      defaultOpen={false}
      right={status && <span className={`text-[9px] ${bad ? 'text-warn' : 'text-up'}`}>{bad ? `${bad} do sprawdzenia` : 'OK'}</span>}
    >
      {!status ? (
        <div className="text-[10px] text-muted">ładowanie…</div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {chips.map(([l, on, hint]) => (
              <span key={l} title={hint} className={`border px-1 text-[9px] ${on ? 'border-up/50 text-up' : 'border-line text-muted'}`}>
                {on ? '✓' : '✗'} {l}
              </span>
            ))}
          </div>
          <ul className="space-y-0.5">
            {status.sources.map((x) => {
              const st = x.loading && !x.updatedAt ? ['ŁADUJE', 'text-data'] : x.missing ? ['BRAK', 'text-warn'] : x.stale ? ['STALE', 'text-warn'] : ['OK', 'text-up'];
              return (
                <li key={x.key} className="flex items-center gap-2 text-[9.5px]" title={x.error ? `błąd: ${x.error}` : x.source}>
                  <span className={`w-[44px] shrink-0 font-bold ${st[1]}`}>{st[0]}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{keyLabel(x.key)}</span>
                  <span className="shrink-0 tabular-nums text-muted">{x.updatedAt ? fmtAgo(x.updatedAt, now) : '—'}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 text-[9px] text-muted">
            Serwer działa {Math.floor(status.uptimeSec / 3600)} h {Math.floor((status.uptimeSec % 3600) / 60)} min. Najedź na wiersz, by zobaczyć źródło lub błąd.
          </div>
        </>
      )}
    </Panel>
  );
}

export interface RightPanelProps {
  now: number;
  macro: MacroData | null;
  pulse: SourceResult<PolicyPulse> | null;
  regions: SourceResult<RegionRisk[]> | null;
  goldcal: SourceResult<GoldCalEvent[]> | null;
  season: SourceResult<SeasonalityData | null> | null;
  hubs: HubsData | null;
  status: StatusData | null;
  digest: DigestData | null;
  gpr: SourceResult<GprData | null> | null;
  cbgold: SourceResult<CbGoldData | null> | null;
  reactions: SourceResult<ReactionsData | null> | null;
  onPickBank: (id: string) => void;
  onPickRegion: (r: RegionRisk) => void;
  onPickGoldEvent: (e: GoldCalEvent) => void;
  onShowReserves: () => void;
}

export default function RightPanel(p: RightPanelProps) {
  return (
    <div className="h-full overflow-y-auto">
      <DigestPanel digest={p.digest} now={p.now} />
      <Macro macro={p.macro} now={p.now} />
      <Pulse pulse={p.pulse} now={p.now} onPick={p.onPickBank} />
      <Regions regions={p.regions} gpr={p.gpr} now={p.now} onPick={p.onPickRegion} />
      <CbGoldPanel cb={p.cbgold} now={p.now} />
      <GoldCal cal={p.goldcal} onPick={p.onPickGoldEvent} />
      <ReactionsPanel r={p.reactions} now={p.now} />
      <Season season={p.season} />
      <Reserves hubs={p.hubs} onShow={p.onShowReserves} />
      <Status status={p.status} now={p.now} />
      <div className="px-3 py-3 text-[9px] leading-relaxed text-muted">
        AURUM pokazuje tło i przyczyny w horyzoncie tygodni i miesięcy. Cena, technika, przepływ zleceń i kalendarz USD — w GOLD DESK. Nic tutaj
        nie stanowi rekomendacji inwestycyjnej.
      </div>
    </div>
  );
}

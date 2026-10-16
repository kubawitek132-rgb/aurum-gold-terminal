'use client';

import type { GoldCalEvent, MacroData, PolicyPulse } from '@/lib/types';
import { fmtCountdown } from '@/lib/time';

interface Props {
  now: number;
  macro: MacroData | null;
  pulse: PolicyPulse | null;
  nextEvent: GoldCalEvent | null;
  dataStatus: 'OK' | 'PARTIAL' | 'STALE' | 'OFFLINE' | 'LOADING';
  activeLayers: number;
  totalLayers: number;
  onMenu: () => void;
  onPanels: () => void;
}

const clock = (now: number, tz: string) =>
  new Intl.DateTimeFormat('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);

export default function TopBar({ now, macro, pulse, nextEvent, dataStatus, activeLayers, totalLayers, onMenu, onPanels }: Props) {
  const st = {
    OK: 'text-up border-up/60',
    PARTIAL: 'text-warn border-warn/60',
    STALE: 'text-warn border-warn/60',
    OFFLINE: 'text-down border-down/60',
    LOADING: 'text-data border-data/50 animate-pulse',
  }[dataStatus];
  const label = { OK: 'DANE OK', PARTIAL: 'NIEPEŁNE DANE', STALE: 'STALE', OFFLINE: 'OFFLINE', LOADING: 'ŁADOWANIE' }[dataStatus];
  const evTime = nextEvent ? Date.parse(nextEvent.date + 'T14:00:00Z') : null;
  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel/95 px-2 sm:px-3">
      <button onClick={onMenu} className="border border-line px-2 py-1 text-xs text-muted md:hidden" aria-label="Warstwy">
        ☰
      </button>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center border border-gold/70 text-sm font-black text-gold shadow-[0_0_14px_#D4AF3733]">Au</span>
        <div className="leading-none">
          <div className="text-[13px] font-black tracking-[0.3em] text-gold">AURUM</div>
          <div className="hidden text-[8.5px] tracking-[0.25em] text-muted sm:block">// GOLD MACRO & GEO INTELLIGENCE</div>
        </div>
      </div>
      <div className="mx-1 hidden h-6 w-px bg-line md:block" />
      <div className="hidden items-center gap-3 text-[11px] md:flex">
        <div>
          <span className="text-muted">WAW </span>
          <span className="tabular-nums text-slate-100">{clock(now, 'Europe/Warsaw')}</span>
        </div>
        <div>
          <span className="text-muted">UTC </span>
          <span className="tabular-nums text-slate-300">{clock(now, 'UTC')}</span>
        </div>
      </div>
      <span className={`flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em] ${st}`}>
        <span className={`h-1.5 w-1.5 rounded-full bg-current ${dataStatus === 'OK' ? 'animate-blink' : ''}`} />
        {label}
      </span>
      <span className="hidden text-[10px] tracking-wider text-muted xl:inline">
        LAYERS <span className="text-data">{activeLayers}</span>/{totalLayers}
      </span>

      <div className="ml-auto flex min-w-0 items-center gap-2 text-[10px] leading-tight">
        {macro && (
          <div className="hidden border border-line px-2 py-0.5 sm:block" title={macro.summary}>
            <div className="tracking-[0.2em] text-muted">TŁO MAKRO</div>
            <div className="tabular-nums">
              <span className="text-up">{macro.tailwinds}▲</span> <span className="text-down">{macro.headwinds}▼</span>{' '}
              <span className="text-muted">{macro.neutral}■</span>
            </div>
          </div>
        )}
        {pulse && (
          <div className="hidden border border-line px-2 py-0.5 lg:block" title={pulse.note}>
            <div className="tracking-[0.2em] text-muted">CYKL BANKÓW</div>
            <div className={pulse.label === 'ZACIEŚNIANIE' ? 'text-down' : pulse.label === 'LUZOWANIE' ? 'text-up' : 'text-slate-200'}>
              {pulse.label} <span className="text-muted">{pulse.hikes.length}↑/{pulse.cuts.length}↓</span>
            </div>
          </div>
        )}
        {nextEvent && evTime && (
          <div className="hidden max-w-[260px] border border-gold/40 bg-gold/5 px-2 py-0.5 md:block" title={nextEvent.detail}>
            <div className="tracking-[0.2em] text-gold/80">NAJBLIŻSZE · ZŁOTO</div>
            <div className="truncate text-slate-200">
              {nextEvent.title} <span className="text-warn">· {evTime > now ? fmtCountdown(evTime - now) : 'dziś'}</span>
            </div>
          </div>
        )}
        <button onClick={onPanels} className="border border-line px-2 py-1 text-xs text-muted lg:hidden" aria-label="Panele">
          ▤
        </button>
      </div>
    </header>
  );
}

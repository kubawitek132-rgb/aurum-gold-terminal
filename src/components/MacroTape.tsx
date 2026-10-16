'use client';

import type { TapeItem } from '@/lib/types';
import { fmtSigned, toneClass } from './ui';

function fmtValue(t: TapeItem) {
  if (t.value === null) return '—';
  const v = t.value.toLocaleString('en-US', { minimumFractionDigits: t.decimals, maximumFractionDigits: t.decimals });
  return t.unit === '%' ? `${v}%` : t.unit === 'usd' ? `$${v}` : t.unit === 'bn' ? `$${v} mld` : v;
}

function Item({ t }: { t: TapeItem }) {
  const isRate = t.unit === '%';
  return (
    <span className="flex shrink-0 items-center gap-2 px-4 text-[11px]" title={[t.note, t.asOf ? `odczyt z ${t.asOf}` : '', 'zmiana tygodniowa · FRED'].filter(Boolean).join(' · ')}>
      <span className="font-bold tracking-wider text-slate-400">{t.label}</span>
      <span className="tabular-nums text-slate-100">{fmtValue(t)}</span>
      <span className={`tabular-nums ${toneClass(t.change)}`}>{fmtSigned(t.change, isRate ? 0 : 1, isRate ? ' bp' : '%')}</span>
      <span className="text-[8px] text-muted">1T</span>
      {t.stale && !t.missing ? <span className="text-[8px] text-warn">STALE</span> : null}
      <span className="text-line">│</span>
    </span>
  );
}

/** Pasek makro: wartości i zmiany tygodniowe czynników tła (bez notowań XAU — te są w GOLD DESK). */
export default function MacroTape({ items }: { items: TapeItem[] }) {
  items = items.filter((t) => !t.missing && t.value !== null);
  if (!items.length)
    return <footer className="h-8 shrink-0 border-t border-line bg-panel px-3 text-[11px] leading-8 text-muted">PASEK MAKRO: brak danych FRED (ustaw FRED_API_KEY) lub trwa ładowanie…</footer>;
  return (
    <footer className="group relative h-8 shrink-0 overflow-hidden border-t border-line bg-panel">
      <div className="absolute left-0 top-0 z-10 flex h-full items-center bg-gold px-2 text-[10px] font-black tracking-[0.2em] text-black">MACRO</div>
      <div className="flex h-full w-max animate-ticker items-center pl-16 group-hover:[animation-play-state:paused]">
        {[...items, ...items].map((t, i) => (
          <Item key={`${t.symbol}-${i}`} t={t} />
        ))}
      </div>
    </footer>
  );
}

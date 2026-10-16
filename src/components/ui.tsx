'use client';

import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import type { GoldImpact } from '@/lib/types';
import { fmtAgo } from '@/lib/time';

export function ImpactTag({ impact, small }: { impact: GoldImpact; small?: boolean }) {
  const cls =
    impact === 'BULLISH'
      ? 'border-up/60 text-up bg-up/10'
      : impact === 'BEARISH'
        ? 'border-down/60 text-down bg-down/10'
        : 'border-slate-500/50 text-slate-300 bg-slate-500/10';
  const arrow = impact === 'BULLISH' ? '▲' : impact === 'BEARISH' ? '▼' : '■';
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 ${small ? 'text-[9px]' : 'text-[10px]'} font-bold tracking-wider ${cls}`}>
      {arrow} {impact}
    </span>
  );
}

/** Znacznik świeżości danych: czas aktualizacji / STALE / BRAK DANYCH. */
export function Freshness({ stale, missing, updatedAt, now }: { stale?: boolean; missing?: boolean; updatedAt?: number | null; now: number }) {
  if (missing)
    return (
      <span className="border border-line px-1 text-[9px] font-bold tracking-wider text-muted" title="Źródło nie zwróciło danych — brak klucza API albo chwilowa awaria (szczegóły w panelu STATUS ŹRÓDEŁ)">
        BRAK DANYCH
      </span>
    );
  if (stale)
    return (
      <span className="border border-warn/60 px-1 text-[9px] font-bold tracking-wider text-warn" title={`Ostatnia aktualizacja: ${updatedAt ? new Date(updatedAt).toLocaleString('pl-PL') : '—'}`}>
        STALE · {fmtAgo(updatedAt ?? null, now)}
      </span>
    );
  return <span className="text-[9px] tracking-wider text-muted">{fmtAgo(updatedAt ?? null, now)}</span>;
}

export function Panel({
  title,
  right,
  children,
  defaultOpen = true,
  accent = '#22d3ee',
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 hover:bg-white/[0.02]">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left text-[11px] font-bold tracking-[0.18em]"
          style={{ color: accent }}
        >
          <span className="text-muted">{open ? '▾' : '▸'}</span>
          {title}
        </button>
        <span className="flex items-center gap-2">{right}</span>
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

export function Sparkline({
  values,
  width = 120,
  height = 28,
  color = '#22d3ee',
  fill = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <path d={`${d}L${width},${height}L0,${height}Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.3} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

export function fmtPrice(v: number | null | undefined, decimals = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtSigned(v: number | null | undefined, decimals = 2, suffix = '') {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}${suffix}`;
}

export function toneClass(v: number | null | undefined) {
  if (v === null || v === undefined || v === 0) return 'text-slate-400';
  return v > 0 ? 'text-up' : 'text-down';
}

/** Izoluje błąd jednego fragmentu UI (np. mapy) — reszta terminala działa dalej. */
export class ErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}]`, e, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid h-full min-h-[80px] place-items-center p-4 text-center text-[10.5px] text-muted">
        <div>
          <div className="mb-1 tracking-[0.25em] text-warn">{this.props.label}: BŁĄD</div>
          <div className="mb-2 max-w-[320px] break-words">{this.state.error}</div>
          <button onClick={() => this.setState({ error: null })} className="border border-line px-2 py-0.5 text-data hover:bg-white/5">
            SPRÓBUJ PONOWNIE
          </button>
        </div>
      </div>
    );
  }
}

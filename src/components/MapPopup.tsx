'use client';

import type { PopupData } from '@/lib/popups';
import { ImpactTag, Sparkline } from './ui';
import { IMPACT_COLOR } from '@/lib/layers';

const TONE: Record<string, string> = {
  up: 'text-up',
  down: 'text-down',
  warn: 'text-warn',
  gold: 'text-gold',
  data: 'text-data',
  muted: 'text-muted',
};

export default function MapPopup({ p, onClose }: { p: PopupData; onClose: () => void }) {
  return (
    <div
      className="relative w-full max-w-[340px] border bg-[#070b11]/95 font-mono text-[11px] shadow-2xl backdrop-blur sm:w-[340px]"
      style={{ borderColor: p.color + '88', boxShadow: `0 0 0 1px #000, 0 0 28px ${p.color}22` }}
    >
      {/* narożniki w stylu HUD */}
      <span className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2" style={{ borderColor: p.color }} />
      <span className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2" style={{ borderColor: p.color }} />
      <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2" style={{ borderColor: p.color }} />
      <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2" style={{ borderColor: p.color }} />

      <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: p.color + '44' }}>
        <span className="text-[9px] font-bold tracking-[0.25em]" style={{ color: p.color }}>
          ◉ {p.tag}
        </span>
        <button onClick={onClose} className="text-muted hover:text-white" aria-label="Zamknij">
          [X]
        </button>
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="text-[13px] font-bold leading-snug text-slate-100">{p.title}</div>
        {p.subtitle && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{p.subtitle}</div>}

        <dl className="mt-2 space-y-0.5">
          {p.rows.map((r) => (
            <div key={r.k} className="flex justify-between gap-3 border-b border-dashed border-line/70 py-0.5">
              <dt className="shrink-0 text-[10px] tracking-wider text-muted">{r.k}</dt>
              <dd className={`text-right ${TONE[r.tone ?? ''] ?? 'text-slate-200'}`}>{r.v}</dd>
            </div>
          ))}
        </dl>

        {p.spark && p.spark.values.length > 1 && (
          <div className="mt-2">
            <Sparkline values={p.spark.values} width={300} height={34} color={p.color} fill />
            <div className="text-[9px] text-muted">{p.spark.label}</div>
          </div>
        )}

        {p.body && <p className="mt-2 text-[10.5px] leading-relaxed text-slate-300">{p.body}</p>}

        {p.impact && (
          <div className="mt-2 border-l-2 bg-white/[0.02] px-2 py-1.5" style={{ borderColor: IMPACT_COLOR[p.impact] }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] tracking-[0.2em] text-muted">WPŁYW NA XAU</span>
              <ImpactTag impact={p.impact} small />
            </div>
            {p.impactNote && <p className="mt-1 text-[10px] leading-relaxed text-slate-300">{p.impactNote}</p>}
          </div>
        )}

        {p.links && p.links.length > 0 && (
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
            {p.links.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-[10px] text-data/90 hover:text-data hover:underline">
                  › {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {p.footer && <div className="mt-2 text-[9px] text-muted">{p.footer}</div>}

        {p.sourceUrl && (
          <a
            href={p.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block border px-2 py-1 text-[10px] font-bold tracking-[0.2em] hover:bg-white/5"
            style={{ borderColor: p.color, color: p.color }}
          >
            [OPEN SOURCE ↗]
          </a>
        )}
      </div>
    </div>
  );
}

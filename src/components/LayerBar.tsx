'use client';

import { LAYERS, type LayerId } from '@/lib/layers';
import { Freshness } from './ui';

export interface LayerMeta {
  count: number;
  alert?: number;
  stale?: boolean;
  missing?: boolean;
  updatedAt?: number | null;
  source?: string;
}

interface Props {
  layers: Record<LayerId, boolean>;
  meta: Record<LayerId, LayerMeta>;
  onToggle: (id: LayerId) => void;
  calRange: 168 | 720;
  onCalRange: (r: 168 | 720) => void;
  now: number;
  expanded?: boolean; // wersja mobilna / rozwinięta
}

export default function LayerBar({ layers, meta, onToggle, calRange, onCalRange, now, expanded }: Props) {
  return (
    <nav className={`flex flex-col gap-1 ${expanded ? 'w-full p-2' : 'w-[60px] items-center py-2'}`}>
      {LAYERS.map((l) => {
        const on = layers[l.id];
        const m = meta[l.id];
        return (
          <div key={l.id} className={expanded ? 'border border-line' : ''}>
            <button
              onClick={() => onToggle(l.id)}
              title={`${l.label}${m?.source ? ` — ${m.source}` : ''}`}
              className={`group relative flex items-center gap-2 transition ${
                expanded ? 'w-full px-2 py-2 text-left' : 'h-11 w-11 flex-col justify-center border'
              } ${on ? 'bg-white/[0.03]' : 'opacity-45 hover:opacity-80'}`}
              style={!expanded ? { borderColor: on ? l.color + '99' : '#1a2230', boxShadow: on ? `inset 0 0 12px ${l.color}22` : undefined } : undefined}
            >
              <span className="text-[15px] leading-none" style={{ color: on ? l.color : '#6b7a90' }}>
                {l.icon}
              </span>
              {!expanded && <span className="text-[8px] tracking-wider text-muted">{l.short}</span>}
              {expanded && (
                <span className="flex-1">
                  <span className="block text-[11px] font-bold tracking-wider" style={{ color: on ? l.color : '#6b7a90' }}>
                    {l.label}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[9px] text-muted">
                    {m?.source} <Freshness stale={m?.stale} missing={m?.missing} updatedAt={m?.updatedAt} now={now} />
                  </span>
                </span>
              )}
              <span
                className={`${expanded ? '' : 'absolute -right-1.5 -top-1.5'} min-w-[18px] rounded-sm px-1 text-center text-[9px] font-bold tabular-nums`}
                style={{ background: m?.alert ? '#f59e0b' : on ? l.color : '#1a2230', color: '#05070a' }}
              >
                {m?.alert ? `${m.alert}!` : m?.count ?? 0}
              </span>
              {!expanded && (m?.stale || m?.missing) && <span className="absolute -bottom-1 right-0 h-1.5 w-1.5 rounded-full bg-warn" />}
            </button>
            {l.id === 'calendar' && on && (
              <div className={`flex ${expanded ? 'gap-1 px-2 pb-2' : 'mt-1 flex-col gap-0.5'}`}>
                {([168, 720] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => onCalRange(r)}
                    className={`border px-1 text-[8.5px] tracking-wider ${calRange === r ? 'border-warn text-warn' : 'border-line text-muted'}`}
                  >
                    {r === 168 ? '7D' : '30D'}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

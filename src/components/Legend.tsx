'use client';

import { CAT_COLOR, CAT_LABEL, LEVEL_COLOR, STANCE_COLOR, STANCE_LABEL } from '@/lib/layers';

const Dot = ({ c, ring }: { c: string; ring?: boolean }) => (
  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={ring ? { border: `2px solid ${c}` } : { background: c }} />
);

function Group({ title, items }: { title: string; items: { c: string; l: string; ring?: boolean }[] }) {
  return (
    <div>
      <div className="mb-0.5 text-[8.5px] tracking-[0.2em] text-muted">{title}</div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {items.map((i) => (
          <span key={i.l} className="flex items-center gap-1">
            <Dot c={i.c} ring={i.ring} />
            {i.l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Legenda kolorów warstw (rozwijana w lewym dolnym rogu mapy). */
export default function Legend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="absolute bottom-2 left-2 z-10 max-w-[min(380px,calc(100%-16px))] text-[9.5px] text-slate-300">
      {open && (
        <div className="mb-1 space-y-1.5 border border-line bg-panel/90 p-2 backdrop-blur">
          <Group
            title="BANKI CENTRALNE · KIERUNEK 180 DNI"
            items={[
              ...(['tightening', 'easing', 'hold', 'unknown'] as const).map((k) => ({ c: STANCE_COLOR[k], l: STANCE_LABEL[k] })),
              { c: '#facc15', l: 'kupuje złoto', ring: true },
            ]}
          />
          <Group title="RYZYKO REGIONÓW" items={(['HIGH', 'ELEVATED', 'NORMAL', 'LOW'] as const).map((k) => ({ c: LEVEL_COLOR[k], l: k, ring: true }))} />
          <Group
            title="CHOKEPOINTY"
            items={[
              { c: '#ef4444', l: 'ZAKŁÓCENIA', ring: true },
              { c: '#f59e0b', l: 'PODWYŻSZONE', ring: true },
              { c: '#22c55e', l: 'NORMALNIE', ring: true },
            ]}
          />
          <Group
            title="ZDARZENIA GEO 24H"
            items={[
              { c: '#ef4444', l: 'konflikt' },
              { c: '#f97316', l: 'sankcje' },
              { c: '#eab308', l: 'handel/cła' },
              { c: '#22c55e', l: 'deeskalacja' },
            ]}
          />
          <Group
            title="KALENDARZ"
            items={[
              { c: '#D4AF37', l: 'decyzja banku' },
              { c: '#ef4444', l: 'publikacja (wysoka waga)' },
              { c: '#f59e0b', l: 'publikacja (średnia)' },
              ...(['comex', 'demand', 'holiday'] as const).map((k) => ({ c: CAT_COLOR[k], l: `${CAT_LABEL[k].toLowerCase()} (panel)` })),
            ]}
          />
          <div className="text-[9px] leading-relaxed text-muted">
            Złote łuki = przepływy fizyczne · złote wypełnienie krajów = produkcja (warstwa AU) lub rezerwy (RES).
            <br />
            Klik w marker = szczegóły · klik w kraj = dossier · Esc zamyka · 1–8 warstwy · G = 3D/2D · S = satelita · L = legenda
          </div>
        </div>
      )}
      <button
        onClick={onToggle}
        className={`border px-2 py-0.5 text-[9.5px] font-bold tracking-[0.2em] backdrop-blur ${open ? 'border-data text-data' : 'border-line bg-panel/70 text-muted'}`}
        aria-expanded={open}
      >
        {open ? '× LEGENDA' : '? LEGENDA'}
      </button>
    </div>
  );
}

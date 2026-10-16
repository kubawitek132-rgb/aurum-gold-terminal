'use client';

/** Awaryjny ekran, gdy cała strona się wywróci (np. błąd przy starcie). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid h-dvh place-items-center bg-bg p-6 font-mono text-[11px] text-slate-300">
      <div className="max-w-[420px] border border-line bg-panel p-4">
        <div className="mb-2 text-[12px] font-bold tracking-[0.3em] text-gold">AURUM // BŁĄD</div>
        <p className="mb-3 leading-relaxed">Coś poszło nie tak przy ładowaniu terminala. Dane na serwerze są bezpieczne — spróbuj ponownie.</p>
        <pre className="mb-3 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted">{error.message}{error.digest ? `\nid: ${error.digest}` : ''}</pre>
        <button onClick={reset} className="border border-data px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-data hover:bg-data/10">
          SPRÓBUJ PONOWNIE
        </button>
      </div>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';

// Terminal renderowany wyłącznie w przeglądarce: zegary, odliczania i mapa zależą od czasu/okna,
// więc SSR dawałby tylko ostrzeżenia o niezgodności hydratacji.
const Terminal = dynamic(() => import('./Terminal'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-bg font-mono text-[11px] tracking-[0.35em] text-gold/80">
      AURUM // BOOTING TERMINAL…
    </div>
  ),
});

export default function ClientApp() {
  return <Terminal />;
}

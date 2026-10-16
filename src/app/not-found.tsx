import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid h-dvh place-items-center bg-bg font-mono text-[11px] text-muted">
      <div className="text-center">
        <div className="mb-2 tracking-[0.3em] text-gold">404 // BRAK STRONY</div>
        <Link href="/" className="text-data hover:underline">
          ← wróć do terminala
        </Link>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AURUM // Gold Macro & Geo Intelligence',
  description: 'Tło makro i geopolityczne dla złota: banki centralne, czynniki makro, ryzyko regionów, chokepointy, rynek fizyczny, kalendarz strukturalny.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#05070a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2305070a'/%3E%3Crect x='3' y='3' width='26' height='26' fill='none' stroke='%23D4AF37' stroke-width='2'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='12' font-weight='bold' fill='%23D4AF37' text-anchor='middle'%3EAu%3C/text%3E%3C/svg%3E"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

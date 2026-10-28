import fs from 'node:fs';
import path from 'node:path';
import type { Metadata, Viewport } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Biuro AI — Trading Desk',
  description: 'Operacyjny pulpit Kuby · AURUM (złoto) + Coin Bot (crypto paper)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#090b0e',
};

/** Same desk as public/biuro.html — one source, two URLs (/biuro and /biuro.html). */
function loadDesk(): { style: string; body: string } {
  const file = path.join(process.cwd(), 'public', 'biuro.html');
  const raw = fs.readFileSync(file, 'utf8');
  const style = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  const body = raw.match(/<body>([\s\S]*?)<\/body>/)?.[1];
  if (!style || !body) {
    throw new Error('public/biuro.html is missing <style> or <body>');
  }
  return { style, body };
}

export default function BiuroPage() {
  const { style, body } = loadDesk();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}

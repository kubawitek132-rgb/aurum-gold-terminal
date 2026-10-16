import { NextResponse, type NextRequest } from 'next/server';
import { alertStatus, checkAlerts, maybeSendDigest, sendTelegram, telegramConfigured } from '@/lib/services/alerts';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const secret = process.env.ALERTS_SECRET;
  if (!secret) return true;
  return req.headers.get('x-alerts-secret') === secret || req.nextUrl.searchParams.get('secret') === secret;
}

/** GET /api/alerts — status; GET /api/alerts?run=1 — ręczne sprawdzenie (np. z zewnętrznego crona). */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('run') === '1') {
    if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const fired = await checkAlerts();
    return NextResponse.json({ fired, ...alertStatus() });
  }
  return NextResponse.json(alertStatus());
}

/** POST /api/alerts?test=1 — wiadomość testowa; ?digest=1 — wyślij skrót dnia teraz; bez parametrów — wymuszenie sprawdzenia. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: 'Brak TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID w .env' }, { status: 400 });
  }
  if (req.nextUrl.searchParams.get('digest') === '1') {
    return NextResponse.json({ ok: await maybeSendDigest(true) });
  }
  if (req.nextUrl.searchParams.get('test') === '1') {
    const ok = await sendTelegram('✅ <b>AURUM</b> — test powiadomień działa.');
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ ok: true, fired: await checkAlerts() });
}

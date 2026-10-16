import { NextResponse } from 'next/server';
import { getDigest } from '@/lib/services/digest';

export const dynamic = 'force-dynamic';

/** GET /api/digest — skrót „co się zmieniło” (ten sam, który rano trafia na Telegram). */
export async function GET() {
  return NextResponse.json(await getDigest());
}

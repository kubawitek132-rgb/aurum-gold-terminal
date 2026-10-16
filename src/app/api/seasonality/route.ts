import { NextResponse } from 'next/server';
import { getSeasonality } from '@/lib/services/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getSeasonality());
}

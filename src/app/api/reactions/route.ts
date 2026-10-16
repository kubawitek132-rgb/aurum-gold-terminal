import { NextResponse } from 'next/server';
import { getReactions } from '@/lib/services/extra';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getReactions());
}

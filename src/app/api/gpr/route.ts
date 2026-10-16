import { NextResponse } from 'next/server';
import { getGpr } from '@/lib/services/extra';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getGpr());
}

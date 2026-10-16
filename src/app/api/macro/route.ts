import { NextResponse } from 'next/server';
import { getMacro, getTape } from '@/lib/services/macro';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [macro, tape] = await Promise.all([getMacro(), getTape()]);
  return NextResponse.json({ macro, tape });
}

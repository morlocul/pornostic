import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runScrape } from '@/scraper';

export async function POST() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Doar adminul.' }, { status: 403 });
  return NextResponse.json(await runScrape());
}

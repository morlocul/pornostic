import { NextResponse } from 'next/server';
import { runScrape } from '@/scraper';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await runScrape());
}

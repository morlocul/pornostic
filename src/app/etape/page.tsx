import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { currentRound } from '@/lib/scoring';
import { SEASON } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function EtapePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const { data } = await db().from('matches').select('round, status').eq('season', SEASON);
  redirect(`/etapa/${currentRound(data ?? [])}`);
}

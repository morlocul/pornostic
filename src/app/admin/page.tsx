import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SEASON } from '@/lib/config';
import AdminPanel from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { data: matches } = await db().from('matches')
    .select('*').eq('season', SEASON).order('round').order('kickoff_at');
  const { data: runs } = await db().from('scrape_runs')
    .select('*').order('ran_at', { ascending: false }).limit(10);
  const { data: players } = await db().from('players')
    .select('id, name, nickname').order('name');

  return <AdminPanel matches={matches ?? []} runs={runs ?? []} players={players ?? []} />;
}

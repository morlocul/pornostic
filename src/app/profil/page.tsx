import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: me } = await db().from('players').select('nickname').eq('id', session.playerId).single();

  return <ProfileForm name={session.name} nickname={me?.nickname ?? ''} />;
}

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Doar adminul.' }, { status: 403 });

  const { playerId, newPin } = await req.json().catch(() => ({}));
  if (typeof playerId !== 'string' || typeof newPin !== 'string')
    return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 });
  if (!/^\d{4}$/.test(newPin))
    return NextResponse.json({ error: 'PIN-ul trebuie să aibă exact 4 cifre.' }, { status: 400 });

  const { error } = await db().from('players')
    .update({ pin_hash: await bcrypt.hash(newPin, 10) }).eq('id', playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

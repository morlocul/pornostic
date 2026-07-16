import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, cookieOptions, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || typeof pin !== 'string')
    return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 });

  const { data: player } = await db().from('players').select('*').eq('name', name.trim()).single();
  if (!player || !(await bcrypt.compare(pin, player.pin_hash)))
    return NextResponse.json({ error: 'Nume sau PIN greșit.' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ playerId: player.id, name: player.name, isAdmin: player.is_admin }), cookieOptions());
  return res;
}

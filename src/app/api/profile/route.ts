import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // --- Change nickname (Poreclă) ---
  if ('nickname' in body) {
    if (typeof body.nickname !== 'string')
      return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 });
    const trimmed = body.nickname.trim();
    if (trimmed.length > 20)
      return NextResponse.json({ error: 'Porecla poate avea cel mult 20 de caractere.' }, { status: 400 });
    const nickname = trimmed === '' ? null : trimmed;

    const { error } = await db().from('players').update({ nickname }).eq('id', session.playerId);
    if (error) {
      if (error.code === '23505')
        return NextResponse.json({ error: 'Porecla e deja luată.' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // --- Change PIN ---
  if ('oldPin' in body || 'newPin' in body) {
    const { oldPin, newPin } = body;
    if (typeof oldPin !== 'string' || typeof newPin !== 'string')
      return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 });
    if (!/^\d{4}$/.test(newPin))
      return NextResponse.json({ error: 'PIN-ul nou trebuie să aibă exact 4 cifre.' }, { status: 400 });

    const { data: player } = await db().from('players').select('pin_hash').eq('id', session.playerId).single();
    if (!player || !(await bcrypt.compare(oldPin, player.pin_hash)))
      return NextResponse.json({ error: 'PIN-ul actual e greșit.' }, { status: 401 });

    const { error } = await db().from('players')
      .update({ pin_hash: await bcrypt.hash(newPin, 10) }).eq('id', session.playerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 400 });
}

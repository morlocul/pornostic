import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, cookieOptions, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20)
    return NextResponse.json({ error: 'Numele trebuie să aibă 2–20 de caractere.' }, { status: 400 });
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin))
    return NextResponse.json({ error: 'PIN-ul trebuie să aibă exact 4 cifre.' }, { status: 400 });

  const cleanName = name.trim();
  const { count } = await db().from('players').select('*', { count: 'exact', head: true });
  const isFirst = (count ?? 0) === 0;

  const { data, error } = await db()
    .from('players')
    .insert({ name: cleanName, pin_hash: await bcrypt.hash(pin, 10), is_admin: isFirst })
    .select()
    .single();
  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'Numele este deja luat.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ playerId: data.id, name: data.name, isAdmin: data.is_admin }), cookieOptions());
  return res;
}

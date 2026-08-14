import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isLocked } from '@/lib/scoring';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 });

  const { data: me } = await db().from('players').select('active').eq('id', session.playerId).single();
  if (me?.active === false) return NextResponse.json({ error: 'Cont retras din joc.' }, { status: 403 });

  const { matchId, home, away } = await req.json().catch(() => ({}));
  const valid = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20;
  if (typeof matchId !== 'string' || !valid(home) || !valid(away))
    return NextResponse.json({ error: 'Pronostic invalid.' }, { status: 400 });

  const { data: match } = await db().from('matches').select('*').eq('id', matchId).single();
  if (!match) return NextResponse.json({ error: 'Meci inexistent.' }, { status: 404 });
  if (match.status !== 'scheduled' || isLocked(match.kickoff_at))
    return NextResponse.json({ error: 'Pronosticurile s-au închis — se blochează cu o oră înainte de meci.' }, { status: 403 });

  const { error } = await db().from('predictions').upsert(
    { player_id: session.playerId, match_id: matchId, home_score: home, away_score: away, points: null, updated_at: new Date().toISOString() },
    { onConflict: 'player_id,match_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

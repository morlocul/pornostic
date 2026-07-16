import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { recomputePoints } from '@/lib/recompute';
import { normalizeTeam } from '@/lib/teams';
import { SEASON } from '@/lib/config';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Doar adminul.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.create) {
    const { round, home_team, away_team, kickoff_at } = body;
    if (!Number.isInteger(round) || !home_team || !away_team || !kickoff_at)
      return NextResponse.json({ error: 'Date incomplete.' }, { status: 400 });
    const { error } = await db().from('matches').insert({
      season: SEASON, round, home_team, away_team,
      home_key: normalizeTeam(home_team), away_key: normalizeTeam(away_team),
      kickoff_at, source: 'manual', locked_manual: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { id, home_score, away_score, status, locked_manual, kickoff_at } = body;
  if (typeof id !== 'string') return NextResponse.json({ error: 'ID lipsă.' }, { status: 400 });
  const patch: Record<string, unknown> = { source: 'manual' };
  if (home_score !== undefined) patch.home_score = home_score;
  if (away_score !== undefined) patch.away_score = away_score;
  if (status !== undefined) patch.status = status;
  if (locked_manual !== undefined) patch.locked_manual = locked_manual;
  if (kickoff_at !== undefined) patch.kickoff_at = kickoff_at;
  const { error } = await db().from('matches').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recomputePoints();
  return NextResponse.json({ ok: true });
}

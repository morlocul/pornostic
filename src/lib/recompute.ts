import { db, Match, Prediction } from '@/lib/db';
import { scorePrediction } from '@/lib/scoring';
import { SEASON } from '@/lib/config';

export async function recomputePoints(): Promise<number> {
  const { data: matches, error: mErr } = await db()
    .from('matches').select('*').eq('season', SEASON);
  if (mErr) throw new Error(mErr.message);
  const byId = new Map((matches ?? []).map((m: Match) => [m.id, m]));

  const { data: preds, error: pErr } = await db().from('predictions').select('*');
  if (pErr) throw new Error(pErr.message);

  let updated = 0;
  for (const p of (preds ?? []) as Prediction[]) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    const scoreable = m.status === 'finished' && m.home_score != null && m.away_score != null;
    const points = scoreable
      ? scorePrediction({ home: p.home_score, away: p.away_score }, { home: m.home_score!, away: m.away_score! })
      : null;
    if (points !== p.points) {
      const { error } = await db().from('predictions').update({ points }).eq('id', p.id);
      if (error) throw new Error(error.message);
      updated++;
    }
  }
  return updated;
}

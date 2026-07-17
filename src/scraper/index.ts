import { db } from '@/lib/db';
import { SEASON } from '@/lib/config';
import { normalizeTeam } from '@/lib/teams';
import { recomputePoints } from '@/lib/recompute';
import { FetchedMatch, ScrapeSource } from './types';
import { scores365, fetchGameGoals, fetchGameStatus } from './scores365';
import { sofascore } from './sofascore';
import { thesportsdb } from './thesportsdb';

const SOURCES: ScrapeSource[] = [scores365, sofascore, thesportsdb];

async function upsertMatches(fetched: FetchedMatch[]): Promise<number> {
  if (!fetched.length) return 0;
  const { data: locked, error: lockErr } = await db()
    .from('matches')
    .select('round, home_key')
    .eq('season', SEASON)
    .eq('locked_manual', true);
  if (lockErr) throw new Error(lockErr.message);
  const lockedSet = new Set((locked ?? []).map((m) => `${m.round}|${m.home_key}`));

  const rows = fetched
    .map((m) => ({
      season: SEASON,
      round: m.round,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
      home_key: normalizeTeam(m.homeTeam),
      away_key: normalizeTeam(m.awayTeam),
      kickoff_at: m.kickoffAt,
      status: m.status,
      home_score: m.homeScore,
      away_score: m.awayScore,
      source: 'scraper' as const,
      ...(m.sourceGameId != null ? { source_game_id: m.sourceGameId } : {}),
      ...(m.homeCompId != null ? { home_comp_id: m.homeCompId } : {}),
      ...(m.awayCompId != null ? { away_comp_id: m.awayCompId } : {}),
    }))
    .filter((r) => !lockedSet.has(`${r.round}|${r.home_key}`));

  // Dedupe within the batch (same match can appear on two pages) — Postgres
  // rejects an upsert that touches the same row twice in one statement.
  const unique = new Map(rows.map((r) => [`${r.round}|${r.home_key}`, r]));
  const deduped = [...unique.values()];

  if (!deduped.length) return 0;
  const { error } = await db()
    .from('matches')
    .upsert(deduped, { onConflict: 'season,round,home_key' });
  if (error) throw new Error(error.message);
  return deduped.length;
}

// Best-effort: fill goal-scorer details for finished matches that have a
// 365Scores game id but no goals yet. Never throws — failures leave goals
// null so the match is retried on the next run. Returns the count filled.
async function fillGoals(limit = 8): Promise<number> {
  const { data, error } = await db()
    .from('matches')
    .select('id, source_game_id')
    .eq('season', SEASON)
    .eq('status', 'finished')
    .is('goals', null)
    .not('source_game_id', 'is', null)
    .limit(limit);
  if (error) throw new Error(error.message);
  let filled = 0;
  for (const m of data ?? []) {
    try {
      const goals = await fetchGameGoals(m.source_game_id as number);
      const { error: upErr } = await db().from('matches').update({ goals }).eq('id', m.id);
      if (upErr) throw new Error(upErr.message);
      filled += 1;
    } catch {
      // one game failed — leave it null, retried next run
    }
  }
  return filled;
}

// Best-effort "overdue sweep": 365Scores list endpoints have a transition
// window where a just-ended match has left /fixtures/ but not yet appeared in
// /results/, so fetchSeason() can't see its final score. The per-game endpoint
// has the truth immediately — poll it for matches that should be over by now.
// Never throws; individual game failures are skipped and retried next run.
async function sweepOverdue(limit = 5): Promise<number> {
  // A football match lasts ~105 min incl. halftime; anything kicked off before
  // that is due to be finished.
  const cutoff = new Date(Date.now() - 105 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from('matches')
    .select('id, source_game_id')
    .eq('season', SEASON)
    .eq('status', 'scheduled')
    .eq('locked_manual', false)
    .not('source_game_id', 'is', null)
    .lt('kickoff_at', cutoff)
    .limit(limit);
  if (error) throw new Error(error.message);
  let updated = 0;
  for (const m of data ?? []) {
    try {
      const st = await fetchGameStatus(m.source_game_id as number);
      if (st.finished && st.homeScore != null && st.awayScore != null) {
        const { error: upErr } = await db()
          .from('matches')
          .update({ status: 'finished', home_score: st.homeScore, away_score: st.awayScore })
          .eq('id', m.id);
        if (upErr) throw new Error(upErr.message);
        updated += 1;
      }
    } catch {
      // one game failed — skip silently, retried next run
    }
  }
  return updated;
}

export async function runScrape(): Promise<{ ok: boolean; source: string; upserted: number; message: string }> {
  for (const source of SOURCES) {
    try {
      const fetched = await source.fetchSeason();
      if (!fetched.length) throw new Error('0 matches returned');
      const upserted = await upsertMatches(fetched);
      const result = { ok: true, source: source.name, upserted, message: `ok: ${fetched.length} fetched, ${upserted} upserted` };
      try {
        await db().from('scrape_runs').insert({ source: source.name, ok: true, message: result.message, upserted });
      } catch { /* logging is best-effort */ }
      try {
        const recovered = await sweepOverdue();
        if (recovered > 0) result.message += `; recuperate: ${recovered}`;
      } catch {
        // overdue sweep is best-effort — must never fail the run
      }
      try {
        await recomputePoints();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.message += `; recompute failed: ${msg}`;
      }
      try {
        const filled = await fillGoals();
        if (filled > 0) result.message += `; goluri: ${filled} meciuri`;
      } catch {
        // goals pass is best-effort — must never fail the run
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await db().from('scrape_runs').insert({ source: source.name, ok: false, message, upserted: 0 });
      } catch { /* logging is best-effort */ }
      // fall through to next source
    }
  }
  return { ok: false, source: 'none', upserted: 0, message: 'toate sursele au eșuat' };
}

import { db } from '@/lib/db';
import { SEASON } from '@/lib/config';
import { normalizeTeam } from '@/lib/teams';
import { recomputePoints } from '@/lib/recompute';
import { FetchedMatch, ScrapeSource } from './types';
import { scores365, fetchGameGoals, fetchGameState } from './scores365';
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

  // A match currently 'live' (set by the match-window sweep off the per-game
  // endpoint) must NOT be stomped back to 'scheduled' by the list feed, which
  // may still show it scheduled or omit it mid-play. Its finished signal
  // arrives via the sweep. Same exclusion style as locked_manual.
  const { data: liveRows, error: liveErr } = await db()
    .from('matches')
    .select('round, home_key')
    .eq('season', SEASON)
    .eq('status', 'live');
  if (liveErr) throw new Error(liveErr.message);
  const liveSet = new Set((liveRows ?? []).map((m) => `${m.round}|${m.home_key}`));

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
    .filter((r) => {
      const key = `${r.round}|${r.home_key}`;
      return !lockedSet.has(key) && !liveSet.has(key);
    });

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

// Best-effort "match-window sweep": poll the per-game endpoint — its state is
// live immediately, unlike the list feed which lags behind at the
// scheduled→live→finished transitions. Updates in-play score/minute/goals while
// live and finalizes when ended. Never throws; per-game failures are skipped
// and retried next run.
//
// A match already 'live' is chased on EVERY run with NO age cap, so it can
// never stay stuck live if a scrape misses the moment it ended (the bug that
// froze Craiova–UTA at "89'" for 16h when cron ran only hourly). Matches still
// 'scheduled' are checked within a generous post-kickoff window (6h) so even a
// sparse/unreliable cron finalizes them.
async function sweepMatchWindow(limit = 12): Promise<{ live: number; finalized: number }> {
  const now = Date.now();
  const from = new Date(now - 360 * 60 * 1000).toISOString();
  const to = new Date(now).toISOString();
  const { data, error } = await db()
    .from('matches')
    .select('id, source_game_id')
    .eq('season', SEASON)
    .eq('locked_manual', false)
    .not('source_game_id', 'is', null)
    .or(`status.eq.live,and(status.eq.scheduled,kickoff_at.gte.${from},kickoff_at.lte.${to})`)
    .order('kickoff_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  let live = 0;
  let finalized = 0;
  for (const m of data ?? []) {
    try {
      const st = await fetchGameState(m.source_game_id as number);
      if (st.phase === 'finished' && st.homeScore != null && st.awayScore != null) {
        // Single write: final scores, clear the minute, goals from this payload
        // (no separate goals fetch needed for matches finalized here).
        const { error: upErr } = await db()
          .from('matches')
          .update({
            status: 'finished',
            home_score: st.homeScore,
            away_score: st.awayScore,
            live_minute: null,
            goals: st.goals,
          })
          .eq('id', m.id);
        if (upErr) throw new Error(upErr.message);
        finalized += 1;
      } else if (st.phase === 'live' && st.homeScore != null && st.awayScore != null) {
        const { error: upErr } = await db()
          .from('matches')
          .update({
            status: 'live',
            home_score: st.homeScore,
            away_score: st.awayScore,
            live_minute: st.minute,
            goals: st.goals,
          })
          .eq('id', m.id);
        if (upErr) throw new Error(upErr.message);
        live += 1;
      }
      // phase 'scheduled' → leave untouched
    } catch {
      // one game failed — skip silently, retried next run
    }
  }
  return { live, finalized };
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
        const swept = await sweepMatchWindow();
        const bits: string[] = [];
        if (swept.live > 0) bits.push(`live: ${swept.live}`);
        if (swept.finalized > 0) bits.push(`finalizate: ${swept.finalized}`);
        if (bits.length) result.message += `; ${bits.join(', ')}`;
      } catch {
        // match-window sweep is best-effort — must never fail the run
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

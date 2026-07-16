import { db } from '@/lib/db';
import { SEASON } from '@/lib/config';
import { normalizeTeam } from '@/lib/teams';
import { recomputePoints } from '@/lib/recompute';
import { FetchedMatch, ScrapeSource } from './types';
import { scores365 } from './scores365';
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
        await recomputePoints();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.message += `; recompute failed: ${msg}`;
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

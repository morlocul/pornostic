import { FetchedMatch, ScrapeSource } from './types';

// How often a fallback source may be tried. Sources after the first are only
// reached when the primary fails; hitting them every minute got thesportsdb
// rate-limited (HTTP 429) on 2026-09-20, when scores365 returned 0 matches
// for 6 hours — so no fallback could help either.
export const FALLBACK_COOLDOWN_MS = 10 * 60 * 1000;

export type ScrapeResult = { ok: boolean; source: string; upserted: number; message: string };

export type ScrapeDeps = {
  sources: ScrapeSource[]; // first = primary, tried every run
  upsert(fetched: FetchedMatch[]): Promise<number>;
  log(source: string, ok: boolean, message: string, upserted: number): Promise<void>;
  lastAttemptAt(source: string): Promise<number | null>; // ms epoch of the last logged attempt
  sweep(): Promise<{ live: number; finalized: number }>;
  recompute(): Promise<void>;
  fillGoals(): Promise<number>;
  now(): number;
};

// One scrape: refresh the fixture list from the first source that answers,
// then — ALWAYS, even when every list source failed — follow today's matches
// through the per-game endpoint, recompute points and fill goal scorers. The
// per-game sweep reads game ids already stored in the database, so it does
// not need the list. (Before, it only ran after a successful list fetch: on
// 2026-09-20 Dinamo–Farul had no live score for its whole match.)
export async function runScrapeWith(d: ScrapeDeps): Promise<ScrapeResult> {
  let result: ScrapeResult | null = null;
  const resting: string[] = [];
  for (const [i, source] of d.sources.entries()) {
    if (i > 0) {
      try {
        const last = await d.lastAttemptAt(source.name);
        if (last != null && d.now() - last < FALLBACK_COOLDOWN_MS) {
          resting.push(source.name);
          continue;
        }
      } catch {
        // can't tell when it last ran — try it
      }
    }
    try {
      const fetched = await source.fetchSeason();
      if (!fetched.length) throw new Error('0 matches returned');
      const upserted = await d.upsert(fetched);
      result = { ok: true, source: source.name, upserted, message: `ok: ${fetched.length} fetched, ${upserted} upserted` };
      await d.log(source.name, true, result.message, upserted).catch(() => {});
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await d.log(source.name, false, message, 0).catch(() => {});
    }
  }
  if (!result) {
    result = {
      ok: false,
      source: 'none',
      upserted: 0,
      message: 'toate sursele au eșuat' + (resting.length ? ` (în pauză: ${resting.join(', ')})` : ''),
    };
  }

  try {
    const swept = await d.sweep();
    const bits: string[] = [];
    if (swept.live > 0) bits.push(`live: ${swept.live}`);
    if (swept.finalized > 0) bits.push(`finalizate: ${swept.finalized}`);
    if (bits.length) result.message += `; ${bits.join(', ')}`;
  } catch {
    // match-window sweep is best-effort — must never fail the run
  }
  try {
    await d.recompute();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.message += `; recompute failed: ${msg}`;
  }
  try {
    const filled = await d.fillGoals();
    if (filled > 0) result.message += `; goluri: ${filled} meciuri`;
  } catch {
    // goals pass is best-effort — must never fail the run
  }
  return result;
}

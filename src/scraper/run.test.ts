import { describe, it, expect } from 'vitest';
import { FALLBACK_COOLDOWN_MS, runScrapeWith, ScrapeDeps } from './run';
import { FetchedMatch, ScrapeSource } from './types';

const match: FetchedMatch = {
  round: 11, homeTeam: 'FCSB', awayTeam: 'Otelul Galati',
  kickoffAt: '2026-10-10T18:30:00.000Z', status: 'scheduled', homeScore: null, awayScore: null,
};
const source = (name: string, out: FetchedMatch[] | Error) => {
  const s = { name, calls: 0, async fetchSeason() { s.calls += 1; if (out instanceof Error) throw out; return out; } };
  return s as ScrapeSource & { calls: number };
};

function deps(sources: ScrapeSource[], over: Partial<ScrapeDeps> = {}) {
  const calls = { swept: 0, recomputed: 0, goals: 0, logs: [] as [string, boolean, string][] };
  const d: ScrapeDeps = {
    sources,
    upsert: async (f) => f.length,
    log: async (s, ok, m) => { calls.logs.push([s, ok, m]); },
    lastAttemptAt: async () => null,
    sweep: async () => { calls.swept += 1; return { live: 2, finalized: 0 }; },
    recompute: async () => { calls.recomputed += 1; },
    fillGoals: async () => { calls.goals += 1; return 0; },
    now: () => 1_000_000_000,
    ...over,
  };
  return { d, calls };
}

describe('runScrapeWith', () => {
  it('uses the primary list and follows live matches', async () => {
    const { d, calls } = deps([source('scores365', [match])]);
    const r = await runScrapeWith(d);
    expect(r).toMatchObject({ ok: true, source: 'scores365', upserted: 1 });
    expect(r.message).toContain('live: 2');
    expect(calls.swept).toBe(1);
  });

  // 2026-09-20: scores365's list came back empty for 6 hours and every
  // fallback failed — live tracking must keep going anyway.
  it('still tracks live matches, recomputes and fills goals when every list source fails', async () => {
    const { d, calls } = deps([
      source('scores365', []),
      source('thesportsdb', new Error('thesportsdb r1: HTTP 429')),
      source('sofascore', new Error('sofascore next/0: HTTP 403')),
    ]);
    const r = await runScrapeWith(d);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^toate sursele au eșuat; live: 2$/);
    expect(calls.swept).toBe(1);
    expect(calls.recomputed).toBe(1);
    expect(calls.goals).toBe(1);
    expect(calls.logs.map(([s, ok]) => `${s}:${ok}`)).toEqual(['scores365:false', 'thesportsdb:false', 'sofascore:false']);
  });

  it('rests a fallback tried less than 10 minutes ago, but never the primary', async () => {
    const primary = source('scores365', []);
    const tsdb = source('thesportsdb', [match]);
    const now = 1_000_000_000;
    const { d } = deps([primary, tsdb], {
      now: () => now,
      lastAttemptAt: async () => now - FALLBACK_COOLDOWN_MS + 60_000,
    });
    const r = await runScrapeWith(d);
    expect(primary.calls).toBe(1);
    expect(tsdb.calls).toBe(0);
    expect(r.message).toContain('în pauză: thesportsdb');
  });

  it('tries the fallback again once the pause is over', async () => {
    const tsdb = source('thesportsdb', [match]);
    const now = 1_000_000_000;
    const { d } = deps([source('scores365', new Error('HTTP 500')), tsdb], {
      now: () => now,
      lastAttemptAt: async () => now - FALLBACK_COOLDOWN_MS - 1,
    });
    const r = await runScrapeWith(d);
    expect(tsdb.calls).toBe(1);
    expect(r).toMatchObject({ ok: true, source: 'thesportsdb' });
  });

  it('a failing sweep or goals pass never fails the run', async () => {
    const { d } = deps([source('scores365', [match])], {
      sweep: async () => { throw new Error('boom'); },
      fillGoals: async () => { throw new Error('boom'); },
    });
    const r = await runScrapeWith(d);
    expect(r.ok).toBe(true);
  });
});

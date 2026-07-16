import { TSDB_LEAGUE, TSDB_SEASON } from '@/lib/config';
import { FetchedMatch, ScrapeSource } from './types';

type TsdbEvent = {
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intRound: string;
  strStatus: string | null;
  strTimestamp: string | null;
};

export function parseTsdbEvents(json: unknown): FetchedMatch[] {
  const events = ((json as { events?: TsdbEvent[] | null })?.events ?? []) || [];
  return events
    .filter((e) => e && e.strTimestamp && e.intRound)
    .map((e) => {
      const finished = e.strStatus === 'FT' || (e.intHomeScore != null && e.intAwayScore != null);
      const postponed = e.strStatus === 'POST' || e.strStatus === 'CANC';
      return {
        round: parseInt(e.intRound, 10),
        homeTeam: e.strHomeTeam,
        awayTeam: e.strAwayTeam,
        kickoffAt: new Date(e.strTimestamp + 'Z').toISOString(), // TSDB timestamps are UTC without zone suffix
        status: finished ? 'finished' : postponed ? 'postponed' : 'scheduled',
        homeScore: finished && e.intHomeScore != null ? parseInt(e.intHomeScore, 10) : null,
        awayScore: finished && e.intAwayScore != null ? parseInt(e.intAwayScore, 10) : null,
      } as FetchedMatch;
    });
}

export const thesportsdb: ScrapeSource = {
  name: 'thesportsdb',
  async fetchSeason() {
    const out: FetchedMatch[] = [];
    // Free key truncates big responses — fetch per round. SuperLiga regular season = 30 rounds.
    for (let r = 1; r <= 30; r++) {
      const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${TSDB_LEAGUE}&r=${r}&s=${TSDB_SEASON}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`thesportsdb r${r}: HTTP ${res.status}`);
      out.push(...parseTsdbEvents(await res.json()));
    }
    return out;
  },
};

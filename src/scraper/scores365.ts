import { S365_COMPETITION, S365_SEASON_NUM } from '@/lib/config';
import { FetchedMatch, ScrapeSource } from './types';

const BASE = 'https://webws.365scores.com/web/games';
const QUERY = `?appTypeId=5&langId=1&timezoneName=UTC&competitions=${S365_COMPETITION}&showOdds=false`;
const FIXTURES_URL = `${BASE}/fixtures/${QUERY}`;
const RESULTS_URL = `${BASE}/results/${QUERY}`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
};

type S365Competitor = { name: string; score?: number };
type S365Game = {
  seasonNum?: number;
  roundNum?: number;
  startTime?: string;
  statusGroup?: number;
  statusText?: string;
  homeCompetitor: S365Competitor;
  awayCompetitor: S365Competitor;
};

export function parse365Games(json: unknown): FetchedMatch[] {
  const games = ((json as { games?: S365Game[] | null })?.games ?? []) || [];
  return games
    .filter(Boolean)
    .filter((g) => g.seasonNum === S365_SEASON_NUM)
    .filter((g) => g.roundNum != null && g.startTime)
    .map((g) => {
      const finished = g.statusGroup === 4 || g.statusText === 'Ended';
      const postponed = /postpon|cancel/i.test(g.statusText ?? '');
      const score = (c: S365Competitor) =>
        finished && typeof c.score === 'number' && c.score >= 0 ? Math.round(c.score) : null;
      return {
        round: g.roundNum!,
        homeTeam: g.homeCompetitor.name,
        awayTeam: g.awayCompetitor.name,
        kickoffAt: new Date(g.startTime!).toISOString(),
        status: finished ? 'finished' : postponed ? 'postponed' : 'scheduled',
        homeScore: score(g.homeCompetitor),
        awayScore: score(g.awayCompetitor),
      } as FetchedMatch;
    });
}

async function fetchUrl(url: string): Promise<FetchedMatch[]> {
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`scores365 ${url}: HTTP ${res.status}`);
  return parse365Games(await res.json());
}

export const scores365: ScrapeSource = {
  name: 'scores365',
  async fetchSeason() {
    const [fixtures, results] = await Promise.all([
      fetchUrl(FIXTURES_URL),
      fetchUrl(RESULTS_URL),
    ]);
    return [...fixtures, ...results];
  },
};

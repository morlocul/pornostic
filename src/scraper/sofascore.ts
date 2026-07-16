import { SOFA_TOURNAMENT, SOFA_SEASON } from '@/lib/config';
import { FetchedMatch, ScrapeSource } from './types';

const BASE = `https://api.sofascore.com/api/v1/unique-tournament/${SOFA_TOURNAMENT}/season/${SOFA_SEASON}/events`;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

type SofaEvent = {
  roundInfo?: { round?: number };
  homeTeam: { name: string };
  awayTeam: { name: string };
  startTimestamp: number;
  status: { type: string };
  homeScore: { current?: number };
  awayScore: { current?: number };
};

export function parseSofascoreEvents(json: unknown): FetchedMatch[] {
  const events = ((json as { events?: SofaEvent[] })?.events ?? []).filter(Boolean);
  return events
    .filter((e) => e.roundInfo?.round != null)
    .map((e) => {
      const finished = e.status.type === 'finished';
      const postponed = e.status.type === 'postponed' || e.status.type === 'canceled';
      return {
        round: e.roundInfo!.round!,
        homeTeam: e.homeTeam.name,
        awayTeam: e.awayTeam.name,
        kickoffAt: new Date(e.startTimestamp * 1000).toISOString(),
        status: finished ? 'finished' : postponed ? 'postponed' : 'scheduled',
        homeScore: finished ? (e.homeScore.current ?? null) : null,
        awayScore: finished ? (e.awayScore.current ?? null) : null,
      } as FetchedMatch;
    });
}

async function fetchPages(kind: 'last' | 'next'): Promise<FetchedMatch[]> {
  const out: FetchedMatch[] = [];
  for (let page = 0; page < 12; page++) {
    const res = await fetch(`${BASE}/${kind}/${page}`, { headers: HEADERS, cache: 'no-store' });
    if (res.status === 404) break; // past the last page
    if (!res.ok) throw new Error(`sofascore ${kind}/${page}: HTTP ${res.status}`);
    const json = await res.json();
    out.push(...parseSofascoreEvents(json));
    if (!(json as { hasNextPage?: boolean }).hasNextPage) break;
  }
  return out;
}

export const sofascore: ScrapeSource = {
  name: 'sofascore',
  async fetchSeason() {
    const [finished, upcoming] = await Promise.all([fetchPages('last'), fetchPages('next')]);
    return [...finished, ...upcoming];
  },
};

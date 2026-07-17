import { S365_COMPETITION, S365_SEASON_NUM } from '@/lib/config';
import { MatchGoal } from '@/lib/db';
import { FetchedMatch, ScrapeSource } from './types';

const BASE = 'https://webws.365scores.com/web/games';
const QUERY = `?appTypeId=5&langId=1&timezoneName=UTC&competitions=${S365_COMPETITION}&showOdds=false`;
const FIXTURES_URL = `${BASE}/fixtures/${QUERY}`;
const RESULTS_URL = `${BASE}/results/${QUERY}`;
const GAME_URL = (gameId: number) =>
  `https://webws.365scores.com/web/game/?appTypeId=5&langId=1&timezoneName=UTC&gameId=${gameId}`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
};

type S365Competitor = { id?: number; name: string; score?: number };
type S365Game = {
  id?: number;
  seasonNum?: number;
  roundNum?: number;
  startTime?: string;
  statusGroup?: number;
  statusText?: string;
  gameTime?: number;
  gameTimeDisplay?: string;
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
        ...(typeof g.id === 'number' ? { sourceGameId: g.id } : {}),
        ...(typeof g.homeCompetitor.id === 'number' ? { homeCompId: g.homeCompetitor.id } : {}),
        ...(typeof g.awayCompetitor.id === 'number' ? { awayCompId: g.awayCompetitor.id } : {}),
      } as FetchedMatch;
    });
}

type S365Event = {
  competitorId?: number;
  gameTime?: number;
  gameTimeDisplay?: string;
  playerId?: number;
  eventType?: { name?: string; subTypeName?: string | null };
};
type S365GameDetail = {
  game?: {
    homeCompetitor?: { id?: number };
    awayCompetitor?: { id?: number };
    members?: { id?: number; name?: string }[];
    events?: S365Event[];
  };
};

export function parse365Goals(json: unknown): MatchGoal[] {
  const game = (json as S365GameDetail)?.game;
  if (!game) return [];
  const awayId = game.awayCompetitor?.id;
  const names = new Map(
    (game.members ?? []).map((m) => [m.id, m.name] as const),
  );
  const kindOf = (subType?: string | null): MatchGoal['kind'] => {
    if (subType === 'Penalty') return 'penalty';
    if (subType === 'Own Goal') return 'own_goal';
    return 'goal';
  };
  return (game.events ?? [])
    .filter((e) => e.eventType?.name === 'Goal')
    .slice()
    .sort((a, b) => (a.gameTime ?? 0) - (b.gameTime ?? 0))
    .map((e) => ({
      min: e.gameTimeDisplay ?? '',
      player: names.get(e.playerId) ?? 'necunoscut',
      side: e.competitorId === awayId ? 'away' : 'home',
      kind: kindOf(e.eventType?.subTypeName),
    }));
}

export async function fetchGameGoals(gameId: number): Promise<MatchGoal[]> {
  const res = await fetch(GAME_URL(gameId), { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`scores365 game ${gameId}: HTTP ${res.status}`);
  return parse365Goals(await res.json());
}

// Reads the single-game endpoint's truth: a match is finished when
// statusGroup === 4 (or statusText 'Ended'); scores are plain numbers, -1
// until played. Tolerates missing/malformed input → not finished, null scores.
export function parse365GameStatus(json: unknown): {
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
} {
  const game = (json as { game?: S365Game } | null)?.game;
  if (!game) return { finished: false, homeScore: null, awayScore: null };
  const finished = game.statusGroup === 4 || game.statusText === 'Ended';
  const score = (c?: S365Competitor) =>
    finished && typeof c?.score === 'number' && c.score >= 0 ? Math.round(c.score) : null;
  return { finished, homeScore: score(game.homeCompetitor), awayScore: score(game.awayCompetitor) };
}

export type GameState = {
  phase: 'scheduled' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
  minute: string | null;
  goals: MatchGoal[];
};

// Full state from the single-game endpoint, used for live tracking. VERIFIED
// on 365Scores: statusGroup 4 (or statusText 'Ended') = finished with final
// scores; statusGroup 2 = scheduled (scores -1). Live is coded defensively —
// treated as live when NOT finished AND (statusGroup === 3, OR gameTime > 0,
// OR statusText is a non-Scheduled/non-Ended active string like 'Halftime').
// Scores are surfaced when live or finished (>= 0 guard); minute prefers
// gameTimeDisplay ("67'"), falls back to statusText ("Halftime"), else null.
// Goals are parsed from the same payload. Tolerates garbage → scheduled/nulls.
export function parse365GameState(json: unknown): GameState {
  const game = (json as { game?: S365Game } | null)?.game;
  if (!game) return { phase: 'scheduled', homeScore: null, awayScore: null, minute: null, goals: [] };

  const finished = game.statusGroup === 4 || game.statusText === 'Ended';
  const gt = typeof game.gameTime === 'number' ? game.gameTime : -1;
  const st = (game.statusText ?? '').trim();
  const activeText = st !== '' && !/scheduled|postpon|cancel|abandon|suspend|ended/i.test(st);
  const live = !finished && (game.statusGroup === 3 || gt > 0 || activeText);
  const phase: GameState['phase'] = finished ? 'finished' : live ? 'live' : 'scheduled';

  const scoreOf = (c?: S365Competitor) =>
    (finished || live) && typeof c?.score === 'number' && c.score >= 0 ? Math.round(c.score) : null;
  const gtd = (game.gameTimeDisplay ?? '').trim();
  const minute = live ? (gtd !== '' ? gtd : st !== '' ? st : null) : null;

  return {
    phase,
    homeScore: scoreOf(game.homeCompetitor),
    awayScore: scoreOf(game.awayCompetitor),
    minute,
    goals: parse365Goals(json),
  };
}

export async function fetchGameStatus(gameId: number): Promise<{
  finished: boolean;
  homeScore: number | null;
  awayScore: number | null;
}> {
  const res = await fetch(GAME_URL(gameId), { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`scores365 game ${gameId}: HTTP ${res.status}`);
  return parse365GameStatus(await res.json());
}

export async function fetchGameState(gameId: number): Promise<GameState> {
  const res = await fetch(GAME_URL(gameId), { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`scores365 game ${gameId}: HTTP ${res.status}`);
  return parse365GameState(await res.json());
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

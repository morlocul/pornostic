import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseSofascoreEvents } from './sofascore';
import { parseTsdbEvents } from './thesportsdb';
import { parse365Games, parse365Goals } from './scores365';
import { S365_SEASON_NUM } from '@/lib/config';

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.resolve(__dirname, '../../tests/fixtures', f), 'utf8'));

describe('parseSofascoreEvents', () => {
  const parsed = () => parseSofascoreEvents(fixture('sofascore-events.json'));
  it('maps a finished match', () => {
    const m = parsed()[0];
    expect(m).toEqual({
      round: 1, homeTeam: 'Metaloglobus', awayTeam: 'U Cluj',
      kickoffAt: new Date(1752249600 * 1000).toISOString(),
      status: 'finished', homeScore: 1, awayScore: 4,
    });
  });
  it('maps a not-started match with null scores', () => {
    const m = parsed()[1];
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
  });
  it('maps a postponed match with null scores', () => {
    const m = parsed()[2];
    expect(m.status).toBe('postponed');
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
  });
});

describe('parseTsdbEvents', () => {
  const parsed = () => parseTsdbEvents(fixture('tsdb-round.json'));
  it('maps a finished match with numeric scores', () => {
    const m = parsed()[0];
    expect(m.round).toBe(1);
    expect(m.status).toBe('finished');
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(4);
    expect(m.kickoffAt).toBe('2025-07-11T16:00:00.000Z'); // strTimestamp treated as UTC
  });
  it('maps a not-started match', () => {
    const m = parsed()[1];
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeNull();
  });
  it('tolerates a null events payload', () => {
    expect(parseTsdbEvents({ events: null })).toEqual([]);
  });
});

describe('parse365Games', () => {
  const parsed = () => parse365Games(fixture('s365-games.json'));
  it('maps a finished match with rounded scores and ISO kickoff', () => {
    const m = parsed()[0];
    expect(m).toEqual({
      round: 5, homeTeam: 'FC Botosani', awayTeam: 'AFC Hermannstadt',
      kickoffAt: new Date('2026-08-15T18:30:00+00:00').toISOString(),
      status: 'finished', homeScore: 3, awayScore: 0, sourceGameId: 100001,
      homeCompId: 5001, awayCompId: 5002,
    });
  });
  it('maps a scheduled match with null scores', () => {
    const m = parsed()[1];
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
  });
  it('filters out games from other seasons', () => {
    expect(parsed()).toHaveLength(2);
  });
  it('tolerates a null games payload', () => {
    expect(parse365Games({ games: null })).toEqual([]);
  });
  it('maps sourceGameId from the game id', () => {
    expect(parsed()[0].sourceGameId).toBe(100001);
  });
  it('maps home/away competitor ids for logos', () => {
    expect(parsed()[0].homeCompId).toBe(5001);
    expect(parsed()[0].awayCompId).toBe(5002);
    expect(parsed()[1].homeCompId).toBe(5003);
    expect(parsed()[1].awayCompId).toBe(5001);
  });
  it('tolerates games without competitor ids (fields stay undefined)', () => {
    const [m] = parse365Games({
      games: [
        {
          seasonNum: S365_SEASON_NUM,
          roundNum: 1,
          startTime: '2026-08-15T18:30:00+00:00',
          statusText: 'Scheduled',
          homeCompetitor: { name: 'A' },
          awayCompetitor: { name: 'B' },
        },
      ],
    });
    expect(m.homeCompId).toBeUndefined();
    expect(m.awayCompId).toBeUndefined();
  });
});

describe('parse365Goals', () => {
  const goals = () => parse365Goals(fixture('s365-game-detail.json'));
  it('excludes non-goal events (Yellow Card)', () => {
    expect(goals()).toHaveLength(3);
  });
  it('preserves the minute display incl. added time', () => {
    expect(goals()[0].min).toBe("19'");
    expect(goals()[1].min).toBe("45'+2");
  });
  it('resolves the scorer name via members', () => {
    expect(goals()[0].player).toBe('Andrei Ciobanu');
    expect(goals()[1].player).toBe('Ianis Stoica');
  });
  it('maps the side from home/away competitor id', () => {
    expect(goals()[0].side).toBe('home');
    expect(goals()[1].side).toBe('away');
  });
  it('maps kind from subTypeName', () => {
    expect(goals()[0].kind).toBe('goal');
    expect(goals()[1].kind).toBe('penalty');
    expect(goals()[2].kind).toBe('own_goal');
  });
  it('keeps own-goal side as the scoring competitor (does not flip)', () => {
    expect(goals()[2].side).toBe('home');
  });
  it('falls back to "necunoscut" when the member is missing', () => {
    expect(goals()[2].player).toBe('necunoscut');
  });
  it('orders goals by gameTime', () => {
    expect(goals().map((g) => g.min)).toEqual(["19'", "45'+2", "70'"]);
  });
  it('tolerates an empty game object', () => {
    expect(parse365Goals({ game: {} })).toEqual([]);
  });
});

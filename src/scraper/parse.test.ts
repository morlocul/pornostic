import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseSofascoreEvents } from './sofascore';
import { parseTsdbEvents } from './thesportsdb';

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

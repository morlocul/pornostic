import { describe, it, expect } from 'vitest';
import { scorePrediction, isLocked, currentRound, LOCK_MINUTES } from './scoring';

describe('scorePrediction', () => {
  it('exact score = 2 points', () => {
    expect(scorePrediction({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(2);
    expect(scorePrediction({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(2);
  });
  it('correct 1X2 but wrong score = 1 point', () => {
    expect(scorePrediction({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe(1); // home win
    expect(scorePrediction({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1); // draw
    expect(scorePrediction({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(1); // away win
  });
  it('wrong outcome = 0 points', () => {
    expect(scorePrediction({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0);
    expect(scorePrediction({ home: 1, away: 1 }, { home: 1, away: 0 })).toBe(0);
    expect(scorePrediction({ home: 0, away: 1 }, { home: 1, away: 1 })).toBe(0);
  });
});

describe('isLocked', () => {
  const kickoff = new Date('2026-07-20T18:00:00Z');
  const ms = (minsBefore: number) => new Date(kickoff.getTime() - minsBefore * 60_000);
  it(`open until ${LOCK_MINUTES} minute(s) before kickoff`, () => {
    // one minute earlier than the lock boundary → still open
    expect(isLocked(kickoff, ms(LOCK_MINUTES + 1))).toBe(false);
  });
  it(`locked from ${LOCK_MINUTES} minute(s) before, at kickoff, and after`, () => {
    expect(isLocked(kickoff, ms(LOCK_MINUTES))).toBe(true); // exactly at the boundary
    expect(isLocked(kickoff, ms(0))).toBe(true); // kickoff
    expect(isLocked(kickoff, new Date('2026-07-21T00:00:00Z'))).toBe(true); // after
  });
});

describe('currentRound', () => {
  it('is the lowest round with a scheduled match', () => {
    expect(currentRound([
      { round: 1, status: 'finished' }, { round: 2, status: 'finished' },
      { round: 2, status: 'scheduled' }, { round: 3, status: 'scheduled' },
    ])).toBe(2);
  });
  it('counts a live match as open — lowest round with only live+finished is current', () => {
    expect(currentRound([
      { round: 2, status: 'live' }, { round: 2, status: 'live' },
      { round: 2, status: 'finished' }, { round: 2, status: 'live' },
      { round: 3, status: 'scheduled' },
    ])).toBe(2);
  });
  it('falls back to the highest round when everything finished', () => {
    expect(currentRound([
      { round: 1, status: 'finished' }, { round: 2, status: 'finished' },
    ])).toBe(2);
  });
  it('ignores postponed matches', () => {
    expect(currentRound([
      { round: 1, status: 'postponed' }, { round: 3, status: 'scheduled' },
    ])).toBe(3);
  });
  it('returns 1 for empty list', () => {
    expect(currentRound([])).toBe(1);
  });
  it('skips a fully-postponed round (current behavior)', () => {
    expect(currentRound([
      { round: 1, status: 'postponed' }, { round: 1, status: 'postponed' },
      { round: 2, status: 'scheduled' },
    ])).toBe(2);
  });
  it('picks the round of the earliest-kickoff open match, not the lowest number', () => {
    // Round 4 has one match rescheduled far into the future; round 5 is playing now.
    // The current round must be 5, not 4. (Real bug: CFR–U Cluj moved to October.)
    expect(currentRound([
      { round: 4, status: 'scheduled', kickoff_at: '2026-10-08T17:00:00Z' },
      { round: 5, status: 'scheduled', kickoff_at: '2026-08-14T15:30:00Z' },
      { round: 5, status: 'scheduled', kickoff_at: '2026-08-17T18:30:00Z' },
      { round: 6, status: 'scheduled', kickoff_at: '2026-08-21T15:30:00Z' },
    ])).toBe(5);
  });
  it('a live match (kickoff in the past) wins as earliest, keeping its round current', () => {
    expect(currentRound([
      { round: 5, status: 'live', kickoff_at: '2026-08-14T15:30:00Z' },
      { round: 5, status: 'scheduled', kickoff_at: '2026-08-17T18:30:00Z' },
      { round: 4, status: 'scheduled', kickoff_at: '2026-10-08T17:00:00Z' },
    ])).toBe(5);
  });
  it('the postponed match becomes current again once it is the earliest upcoming', () => {
    // By October, rounds 5–10 are done; the rescheduled round-4 match is next.
    expect(currentRound([
      { round: 4, status: 'scheduled', kickoff_at: '2026-10-08T17:00:00Z' },
      { round: 11, status: 'scheduled', kickoff_at: '2026-10-10T15:30:00Z' },
    ])).toBe(4);
  });
});

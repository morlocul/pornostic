import { describe, it, expect } from 'vitest';
import { scorePrediction, isLocked, currentRound } from './scoring';

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
  const kickoff = '2026-07-20T18:00:00Z';
  it('open until 60 minutes before kickoff', () => {
    // 61 min before → still open
    expect(isLocked(kickoff, new Date('2026-07-20T16:59:00Z'))).toBe(false);
  });
  it('locked from 60 minutes before, at kickoff, and after', () => {
    expect(isLocked(kickoff, new Date('2026-07-20T17:00:00Z'))).toBe(true); // exactly 60 min before
    expect(isLocked(kickoff, new Date('2026-07-20T18:00:00Z'))).toBe(true); // kickoff
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
});

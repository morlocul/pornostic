import { describe, it, expect } from 'vitest';
import { monthKey, monthLabel } from './months';

describe('monthKey', () => {
  it('returns the YYYY-MM of a plain mid-month kickoff', () => {
    // 15 July 2026, 12:00 UTC -> 15:00 in Bucharest (summer, UTC+3)
    expect(monthKey('2026-07-15T12:00:00Z')).toBe('2026-07');
  });

  it('uses the Europe/Bucharest calendar day at a month boundary', () => {
    // 21:30 UTC on 31 July -> 00:30 on 1 August in Bucharest -> August
    expect(monthKey('2026-07-31T21:30:00Z')).toBe('2026-08');
  });
});

describe('monthLabel', () => {
  it('maps a key to a capitalized Romanian month name (no year)', () => {
    expect(monthLabel('2026-07')).toBe('Iulie');
    expect(monthLabel('2026-09')).toBe('Septembrie');
  });
});

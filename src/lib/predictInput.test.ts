import { describe, it, expect } from 'vitest';
import { parseScore, isDirty } from './predictInput';

describe('parseScore', () => {
  it('accepts two numbers of 1-2 digits', () => {
    expect(parseScore('2', '0')).toEqual({ home: 2, away: 0 });
    expect(parseScore(' 10', '3 ')).toEqual({ home: 10, away: 3 });
  });
  it('rejects a half-filled or invalid score', () => {
    expect(parseScore('2', '')).toBeNull();
    expect(parseScore('', '')).toBeNull();
    expect(parseScore('100', '1')).toBeNull();
    expect(parseScore('a', '1')).toBeNull();
  });
});

describe('isDirty', () => {
  it('flags a complete score that was never saved (the missed-save case)', () => {
    expect(isDirty('2', '0', null)).toBe(true);
  });
  it('flags a changed score', () => {
    expect(isDirty('2', '1', { home: 2, away: 0 })).toBe(true);
  });
  it('is clean when the score matches what was saved', () => {
    expect(isDirty('2', '0', { home: 2, away: 0 })).toBe(false);
  });
  it('flags a half-filled form so leaving the page warns', () => {
    expect(isDirty('2', '', null)).toBe(true);
  });
  it('is clean when both boxes are empty', () => {
    expect(isDirty('', '', null)).toBe(false);
  });
});

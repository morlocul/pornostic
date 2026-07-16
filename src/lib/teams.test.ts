import { describe, it, expect } from 'vitest';
import { normalizeTeam } from './teams';

describe('normalizeTeam', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeTeam('FC Botoșani')).toBe('botosani');
    expect(normalizeTeam('Botosani')).toBe('botosani');
  });
  it('drops generic club prefixes but keeps identity words', () => {
    expect(normalizeTeam('CS Universitatea Craiova')).toBe('universitatea craiova');
    expect(normalizeTeam('CFR Cluj')).toBe('cfr cluj'); // cfr is identity, not dropped
    expect(normalizeTeam('FCSB')).toBe('fcsb');         // single token, not a prefix
  });
  it('maps known aliases across sources', () => {
    expect(normalizeTeam('U Cluj')).toBe('universitatea cluj');
    expect(normalizeTeam('Universitatea Cluj')).toBe('universitatea cluj');
  });
  it('collapses punctuation and whitespace', () => {
    expect(normalizeTeam('  A.F.C.  Hermannstadt ')).toBe('hermannstadt');
  });
});

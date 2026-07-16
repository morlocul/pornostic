import { describe, it, expect } from 'vitest';
import { csvEscape, csvRow, buildCsv, formatKickoff, formatScore, CSV_HEADER } from './csv';

describe('csvEscape', () => {
  it('leaves a plain field untouched', () => {
    expect(csvEscape('Rapid')).toBe('Rapid');
    expect(csvEscape('')).toBe('');
    expect(csvEscape('2-1')).toBe('2-1');
  });
  it('quotes a field containing the semicolon separator', () => {
    expect(csvEscape('a;b')).toBe('"a;b"');
  });
  it('quotes and doubles embedded double quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('"')).toBe('""""');
  });
  it('quotes a field containing a newline or carriage return', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('csvRow', () => {
  it('joins escaped fields with a semicolon', () => {
    expect(csvRow(['1', 'Rapid', 'Dinamo'])).toBe('1;Rapid;Dinamo');
  });
  it('renders null and undefined as empty fields', () => {
    expect(csvRow(['1', null, undefined])).toBe('1;;');
  });
  it('coerces numbers to strings', () => {
    expect(csvRow([1, 2])).toBe('1;2');
  });
  it('escapes fields with separators inside a row', () => {
    expect(csvRow(['Team; FC', 'x'])).toBe('"Team; FC";x');
  });
});

describe('buildCsv', () => {
  it('prefixes a UTF-8 BOM', () => {
    const doc = buildCsv([['a', 'b']]);
    expect(doc.charCodeAt(0)).toBe(0xfeff);
    expect(doc.startsWith('﻿')).toBe(true);
  });
  it('uses CRLF line endings including a trailing one', () => {
    const doc = buildCsv([['a', 'b'], ['c', 'd']], ['H1', 'H2']);
    expect(doc).toBe('﻿H1;H2\r\na;b\r\nc;d\r\n');
  });
  it('defaults to the export header', () => {
    const doc = buildCsv([]);
    expect(doc).toBe('﻿' + CSV_HEADER.join(';') + '\r\n');
  });
});

describe('formatScore', () => {
  it('formats a played match as home-away', () => {
    expect(formatScore(2, 1)).toBe('2-1');
    expect(formatScore(0, 0)).toBe('0-0');
  });
  it('is empty when either side is null', () => {
    expect(formatScore(null, null)).toBe('');
    expect(formatScore(2, null)).toBe('');
    expect(formatScore(null, 1)).toBe('');
  });
});

describe('formatKickoff', () => {
  it('formats an ISO instant in Europe/Bucharest as DD.MM.YYYY HH:mm', () => {
    // 2026-07-20T15:30:00Z is 18:30 in Bucharest (EEST, UTC+3).
    expect(formatKickoff('2026-07-20T15:30:00Z')).toBe('20.07.2026 18:30');
  });
  it('rolls the day across the local-midnight boundary', () => {
    // 2026-11-01T22:15:00Z is 00:15 on the 2nd in Bucharest (EET, UTC+2).
    expect(formatKickoff('2026-11-01T22:15:00Z')).toBe('02.11.2026 00:15');
  });
});

import { describe, it, expect } from 'vitest';
import { buildExportWorkbook } from './xlsx';

// A tiny in-memory dataset: 2 players, 2 matches (one finished+scored, one
// future+unlocked). `now` is fixed so m1 is locked and m2 is not.
// The two matches deliberately fall in different months (July / August) so the
// Luna column and the "Pe luni" breakdown have more than one month to show.
const NOW = new Date('2026-07-16T12:00:00Z');

const players = [
  { id: 'p1', name: 'Ana', nickname: null },
  { id: 'p2', name: 'Bogdan', nickname: 'Bogza' },
];

const matches = [
  {
    id: 'm1', round: 1, kickoff_at: '2026-07-10T15:00:00Z',
    home_team: 'Rapid', away_team: 'Dinamo', home_score: 1, away_score: 1,
  },
  {
    id: 'm2', round: 2, kickoff_at: '2026-08-25T15:00:00Z',
    home_team: 'FCSB', away_team: 'CFR', home_score: null, away_score: null,
  },
];

const predictions = [
  { match_id: 'm1', player_id: 'p1', home_score: 1, away_score: 1, points: 2 },
  { match_id: 'm1', player_id: 'p2', home_score: 1, away_score: 0, points: 1 },
  { match_id: 'm2', player_id: 'p1', home_score: 2, away_score: 0, points: null },
  { match_id: 'm2', player_id: 'p2', home_score: 0, away_score: 1, points: null },
];

const EXACT_FILL = 'FFB7E4C7'; // green fill used for exact scores / month winners

async function build(forPlayerId: string) {
  return buildExportWorkbook({ matches, predictions, players, forPlayerId, now: NOW });
}

describe('buildExportWorkbook — Pronosticuri sheet', () => {
  it('creates all three named sheets', async () => {
    const wb = await build('p1');
    expect(wb.getWorksheet('Pronosticuri')).toBeTruthy();
    expect(wb.getWorksheet('Pe luni')).toBeTruthy();
    expect(wb.getWorksheet('Clasament')).toBeTruthy();
  });

  it('header row has the fixed columns (incl. Luna) then one column per player', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const header = ws.getRow(1);
    expect(header.getCell(1).value).toBe('Etapa');
    expect(header.getCell(2).value).toBe('Data');
    expect(header.getCell(3).value).toBe('Luna');
    expect(header.getCell(4).value).toBe('Meci');
    expect(header.getCell(5).value).toBe('Scor final');
    // Players in name order: Ana (col 6), Bogza=nickname of Bogdan (col 7).
    expect(header.getCell(6).value).toBe('Ana');
    expect(header.getCell(7).value).toBe('Bogza');
  });

  it('has a bold TOTAL row under the header with each players season total', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const total = ws.getRow(2);
    expect(total.getCell(4).value).toBe('TOTAL'); // in the Meci column
    expect(total.getCell(6).value).toBe(2); // Ana: 2 pts
    expect(total.getCell(7).value).toBe(1); // Bogza: 1 pt
    expect(total.getCell(4).font?.bold).toBe(true);
    expect(total.getCell(6).font?.bold).toBe(true);
  });

  it('builds one row per match (after the TOTAL row) sorted by round asc', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r1 = ws.getRow(3); // m1 (round 1)
    expect(r1.getCell(1).value).toBe(1);
    expect(r1.getCell(4).value).toBe('Rapid – Dinamo');
    expect(r1.getCell(5).value).toBe('1-1');
    const r2 = ws.getRow(4); // m2 (round 2)
    expect(r2.getCell(1).value).toBe(2);
    expect(r2.getCell(4).value).toBe('FCSB – CFR');
    expect(r2.getCell(5).value).toBe('');
  });

  it('fills the Luna column with the Romanian month name of the kickoff', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    expect(ws.getRow(3).getCell(3).value).toBe('Iulie');  // m1 = July
    expect(ws.getRow(4).getCell(3).value).toBe('August'); // m2 = August
  });

  it('shows finished+scored predictions with points for every player', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r1 = ws.getRow(3); // m1
    expect(r1.getCell(6).value).toBe('1-1 (2p)'); // Ana / p1
    expect(r1.getCell(7).value).toBe('1-0 (1p)'); // Bogza / p2
  });

  it('hides other players picks on an unlocked match but shows the requester own', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r2 = ws.getRow(4); // m2, unlocked
    expect(r2.getCell(6).value).toBe('2-0'); // Ana / p1 = requester, own pick visible
    expect(r2.getCell(7).value).toBe('🔒');   // Bogza / p2 = other, locked
  });

  it('shows the OTHER requester their own pick and locks the first', async () => {
    const wb = await build('p2');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r2 = ws.getRow(4); // m2, unlocked
    expect(r2.getCell(6).value).toBe('🔒');   // Ana / p1 = other, locked
    expect(r2.getCell(7).value).toBe('0-1'); // Bogza / p2 = requester
  });

  it('leaves a cell empty when the player made no prediction', async () => {
    const wb = await buildExportWorkbook({
      matches, players, forPlayerId: 'p1', now: NOW,
      predictions: [{ match_id: 'm1', player_id: 'p1', home_score: 1, away_score: 1, points: 2 }],
    });
    const ws = wb.getWorksheet('Pronosticuri')!;
    // p2 (col 7) has no prediction on m1 (row 3) → empty.
    expect(ws.getRow(3).getCell(7).value ?? '').toBe('');
  });
});

describe('buildExportWorkbook — Pe luni sheet', () => {
  it('is inserted between Pronosticuri and Clasament', async () => {
    const wb = await build('p1');
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Pronosticuri', 'Pe luni', 'Clasament',
    ]);
  });

  it('has a header of Luna then one column per player', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pe luni')!;
    const header = ws.getRow(1);
    expect(header.getCell(1).value).toBe('Luna');
    expect(header.getCell(2).value).toBe('Ana');
    expect(header.getCell(3).value).toBe('Bogza');
  });

  it('has one row per month (ascending) with per-player points, then a TOTAL row', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pe luni')!;
    // Row 2 = Iulie (July): Ana 2p, Bogza 1p.
    const july = ws.getRow(2);
    expect(july.getCell(1).value).toBe('Iulie');
    expect(july.getCell(2).value).toBe(2);
    expect(july.getCell(3).value).toBe(1);
    // Row 3 = August: no scored predictions yet → 0 / 0.
    const august = ws.getRow(3);
    expect(august.getCell(1).value).toBe('August');
    expect(august.getCell(2).value).toBe(0);
    expect(august.getCell(3).value).toBe(0);
    // Row 4 = TOTAL (season totals), bold.
    const total = ws.getRow(4);
    expect(total.getCell(1).value).toBe('TOTAL');
    expect(total.getCell(2).value).toBe(2);
    expect(total.getCell(3).value).toBe(1);
    expect(total.getCell(1).font?.bold).toBe(true);
  });

  it('highlights the winning cell(s) of each month with the green exact fill', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pe luni')!;
    const july = ws.getRow(2);
    // Ana leads July → green fill; Bogza does not.
    expect((july.getCell(2).fill as ExcelJS_Fill)?.fgColor?.argb).toBe(EXACT_FILL);
    expect((july.getCell(3).fill as ExcelJS_Fill)?.fgColor?.argb).not.toBe(EXACT_FILL);
    // August is all zeros → nobody highlighted.
    const august = ws.getRow(3);
    expect((august.getCell(2).fill as ExcelJS_Fill)?.fgColor?.argb).not.toBe(EXACT_FILL);
    expect((august.getCell(3).fill as ExcelJS_Fill)?.fgColor?.argb).not.toBe(EXACT_FILL);
  });
});

// Minimal structural type for reading a solid fill's color in assertions.
type ExcelJS_Fill = { fgColor?: { argb?: string } };

describe('buildExportWorkbook — Clasament sheet', () => {
  it('has a header and rows ordered by points desc then exact desc', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Clasament')!;
    const header = ws.getRow(1);
    expect(header.getCell(1).value).toBe('Loc');
    expect(header.getCell(2).value).toBe('Jucător');
    expect(header.getCell(3).value).toBe('Puncte');
    expect(header.getCell(4).value).toBe('Scoruri exacte');
    expect(header.getCell(5).value).toBe('1X2 corecte');
    // Ana = 2 pts (1 exact), Bogza = 1 pt → Ana first.
    const first = ws.getRow(2);
    expect(first.getCell(1).value).toBe(1);
    expect(first.getCell(2).value).toBe('Ana');
    expect(first.getCell(3).value).toBe(2);
    expect(first.getCell(4).value).toBe(1);
    expect(first.getCell(5).value).toBe(0);
    const second = ws.getRow(3);
    expect(second.getCell(1).value).toBe(2);
    expect(second.getCell(2).value).toBe('Bogza');
    expect(second.getCell(3).value).toBe(1);
  });
});

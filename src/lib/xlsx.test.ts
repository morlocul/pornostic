import { describe, it, expect } from 'vitest';
import { buildExportWorkbook } from './xlsx';

// A tiny in-memory dataset: 2 players, 2 matches (one finished+scored, one
// future+unlocked). `now` is fixed so m1 is locked and m2 is not.
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
    id: 'm2', round: 2, kickoff_at: '2026-07-25T15:00:00Z',
    home_team: 'FCSB', away_team: 'CFR', home_score: null, away_score: null,
  },
];

const predictions = [
  { match_id: 'm1', player_id: 'p1', home_score: 1, away_score: 1, points: 2 },
  { match_id: 'm1', player_id: 'p2', home_score: 1, away_score: 0, points: 1 },
  { match_id: 'm2', player_id: 'p1', home_score: 2, away_score: 0, points: null },
  { match_id: 'm2', player_id: 'p2', home_score: 0, away_score: 1, points: null },
];

async function build(forPlayerId: string) {
  return buildExportWorkbook({ matches, predictions, players, forPlayerId, now: NOW });
}

describe('buildExportWorkbook — Pronosticuri sheet', () => {
  it('creates both named sheets', async () => {
    const wb = await build('p1');
    expect(wb.getWorksheet('Pronosticuri')).toBeTruthy();
    expect(wb.getWorksheet('Clasament')).toBeTruthy();
  });

  it('header row has the fixed columns then one column per player (nickname ?? name)', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const header = ws.getRow(1);
    expect(header.getCell(1).value).toBe('Etapa');
    expect(header.getCell(2).value).toBe('Data');
    expect(header.getCell(3).value).toBe('Meci');
    expect(header.getCell(4).value).toBe('Scor final');
    // Players in name order: Ana (col 5), Bogza=nickname of Bogdan (col 6).
    expect(header.getCell(5).value).toBe('Ana');
    expect(header.getCell(6).value).toBe('Bogza');
  });

  it('builds one row per match sorted by round asc with Meci and Scor final', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r1 = ws.getRow(2); // m1 (round 1)
    expect(r1.getCell(1).value).toBe(1);
    expect(r1.getCell(3).value).toBe('Rapid – Dinamo');
    expect(r1.getCell(4).value).toBe('1-1');
    const r2 = ws.getRow(3); // m2 (round 2)
    expect(r2.getCell(1).value).toBe(2);
    expect(r2.getCell(3).value).toBe('FCSB – CFR');
    expect(r2.getCell(4).value).toBe('');
  });

  it('shows finished+scored predictions with points for every player', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r1 = ws.getRow(2); // m1
    expect(r1.getCell(5).value).toBe('1-1 (2p)'); // Ana / p1
    expect(r1.getCell(6).value).toBe('1-0 (1p)'); // Bogza / p2
  });

  it('hides other players picks on an unlocked match but shows the requester own', async () => {
    const wb = await build('p1');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r2 = ws.getRow(3); // m2, unlocked
    expect(r2.getCell(5).value).toBe('2-0'); // Ana / p1 = requester, own pick visible
    expect(r2.getCell(6).value).toBe('🔒');   // Bogza / p2 = other, locked
  });

  it('shows the OTHER requester their own pick and locks the first', async () => {
    const wb = await build('p2');
    const ws = wb.getWorksheet('Pronosticuri')!;
    const r2 = ws.getRow(3); // m2, unlocked
    expect(r2.getCell(5).value).toBe('🔒');   // Ana / p1 = other, locked
    expect(r2.getCell(6).value).toBe('0-1'); // Bogza / p2 = requester
  });

  it('leaves a cell empty when the player made no prediction', async () => {
    const wb = await buildExportWorkbook({
      matches, players, forPlayerId: 'p1', now: NOW,
      predictions: [{ match_id: 'm1', player_id: 'p1', home_score: 1, away_score: 1, points: 2 }],
    });
    const ws = wb.getWorksheet('Pronosticuri')!;
    // p2 (col 6) has no prediction on m1 → empty.
    expect(ws.getRow(2).getCell(6).value ?? '').toBe('');
  });
});

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

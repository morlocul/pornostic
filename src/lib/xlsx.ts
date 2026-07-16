// Formatted Excel (.xlsx) export for the game database.
// Pure given its inputs (no DB access) so it can be unit-tested and reused.
import ExcelJS from 'exceljs';
import { isLocked } from '@/lib/scoring';

export type XlsxMatch = {
  id: string;
  round: number;
  kickoff_at: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

export type XlsxPrediction = {
  match_id: string;
  player_id: string;
  home_score: number;
  away_score: number;
  points: number | null;
};

export type XlsxPlayer = {
  id: string;
  name: string;
  nickname: string | null;
};

export type BuildExportInput = {
  matches: XlsxMatch[];
  predictions: XlsxPrediction[];
  players: XlsxPlayer[];
  forPlayerId: string;
  now?: Date;
};

const LOCK = '🔒';

// '2-1' for a played match, '' when either score is null/undefined.
function formatScore(home: number | null | undefined, away: number | null | undefined): string {
  if (home == null || away == null) return '';
  return `${home}-${away}`;
}

// ISO instant -> 'DD.MM.YYYY HH:mm' in Europe/Bucharest local time.
function formatKickoff(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

const displayName = (p: XlsxPlayer) => p.nickname ?? p.name;

// Colors (ARGB). Kept light so black text stays readable, including in print.
const HEADER_FILL = 'FF1F2937'; // dark slate
const HEADER_FONT = 'FFFFFFFF'; // white
const ZEBRA_FILL = 'FFF3F4F6';  // very light gray (odd rounds)
const EXACT_FILL = 'FFB7E4C7';  // green-ish (2 points)
const CORRECT_FILL = 'FFFFF3B0'; // yellow-ish (1 point)

function solidFill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

export async function buildExportWorkbook(input: BuildExportInput): Promise<ExcelJS.Workbook> {
  const now = input.now ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pornosticul de Folbal';
  wb.created = now;

  // Players ordered by name (column order of the matrix).
  const players = [...input.players].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  // Matches sorted by round asc, then kickoff asc.
  const matches = [...input.matches].sort(
    (a, b) => a.round - b.round || a.kickoff_at.localeCompare(b.kickoff_at),
  );

  // Index predictions by "matchId|playerId".
  const predByKey = new Map<string, XlsxPrediction>();
  for (const p of input.predictions) predByKey.set(`${p.match_id}|${p.player_id}`, p);

  buildPronosticuriSheet(wb, matches, players, predByKey, input.forPlayerId, now);
  buildClasamentSheet(wb, matches, players, input.predictions);

  return wb;
}

function buildPronosticuriSheet(
  wb: ExcelJS.Workbook,
  matches: XlsxMatch[],
  players: XlsxPlayer[],
  predByKey: Map<string, XlsxPrediction>,
  forPlayerId: string,
  now: Date,
) {
  const ws = wb.addWorksheet('Pronosticuri', { views: [{ state: 'frozen', ySplit: 1 }] });

  // Column widths: Etapa, Data, Meci, Scor final, then one per player.
  ws.columns = [
    { width: 8 },
    { width: 16 },
    { width: 34 },
    { width: 12 },
    ...players.map(() => ({ width: 14 })),
  ];

  // Header row.
  const headerValues = ['Etapa', 'Data', 'Meci', 'Scor final', ...players.map(displayName)];
  const header = ws.addRow(headerValues);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = solidFill(HEADER_FILL);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  for (const m of matches) {
    const locked = isLocked(m.kickoff_at, now);
    const rowValues: (string | number)[] = [
      m.round,
      formatKickoff(m.kickoff_at),
      `${m.home_team} – ${m.away_team}`,
      formatScore(m.home_score, m.away_score),
    ];

    const cellFills: (string | null)[] = [];
    for (const pl of players) {
      const pred = predByKey.get(`${m.id}|${pl.id}`);
      if (!pred) {
        rowValues.push('');
        cellFills.push(null);
        continue;
      }
      // Hide other players' picks on a match that is not yet locked.
      if (!locked && pl.id !== forPlayerId) {
        rowValues.push(LOCK);
        cellFills.push(null);
        continue;
      }
      const score = formatScore(pred.home_score, pred.away_score);
      rowValues.push(pred.points == null ? score : `${score} (${pred.points}p)`);
      cellFills.push(
        pred.points === 2 ? EXACT_FILL : pred.points === 1 ? CORRECT_FILL : null,
      );
    }

    const row = ws.addRow(rowValues);
    const zebra = m.round % 2 === 1; // subtle fill on odd rounds
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      const playerFill = colNumber >= 5 ? cellFills[colNumber - 5] : null;
      if (playerFill) cell.fill = solidFill(playerFill);
      else if (zebra) cell.fill = solidFill(ZEBRA_FILL);
    });
  }
}

function buildClasamentSheet(
  wb: ExcelJS.Workbook,
  matches: XlsxMatch[],
  players: XlsxPlayer[],
  predictions: XlsxPrediction[],
) {
  const ws = wb.addWorksheet('Clasament', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { width: 6 },
    { width: 22 },
    { width: 10 },
    { width: 16 },
    { width: 14 },
  ];

  const matchIds = new Set(matches.map((m) => m.id));

  const standings = players.map((pl) => {
    const mine = predictions.filter(
      (p) => p.player_id === pl.id && matchIds.has(p.match_id) && p.points != null,
    );
    return {
      label: displayName(pl),
      points: mine.reduce((s, p) => s + (p.points ?? 0), 0),
      exact: mine.filter((p) => p.points === 2).length,
      correct: mine.filter((p) => p.points === 1).length,
    };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);

  const header = ws.addRow(['Loc', 'Jucător', 'Puncte', 'Scoruri exacte', '1X2 corecte']);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = solidFill(HEADER_FILL);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  standings.forEach((s, i) => {
    const row = ws.addRow([i + 1, s.label, s.points, s.exact, s.correct]);
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
      };
      if (colNumber === 3) cell.font = { bold: true };
    });
  });
}

// Formatted Excel (.xlsx) export for the game database.
// Pure given its inputs (no DB access) so it can be unit-tested and reused.
import ExcelJS from 'exceljs';
import { isLocked } from '@/lib/scoring';
import { monthKey, monthLabel } from '@/lib/months';

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
  /** true = pronosticurile tuturor apar și la meciurile neblocate (fără 🔒). */
  revealAll?: boolean;
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

  // Month (YYYY-MM) of each match, and the distinct months present, ascending.
  const monthByMatch = new Map<string, string>();
  for (const m of matches) monthByMatch.set(m.id, monthKey(m.kickoff_at));
  const months = [...new Set(monthByMatch.values())].sort();

  // Scored points per player per month (only predictions on known matches).
  const pointsByPlayerMonth = new Map<string, Map<string, number>>();
  for (const pl of players) pointsByPlayerMonth.set(pl.id, new Map());
  for (const p of input.predictions) {
    if (p.points == null) continue;
    const mk = monthByMatch.get(p.match_id);
    const perMonth = pointsByPlayerMonth.get(p.player_id);
    if (!mk || !perMonth) continue;
    perMonth.set(mk, (perMonth.get(mk) ?? 0) + p.points);
  }

  // Season total per player = sum across months.
  const seasonTotals = new Map<string, number>();
  for (const pl of players) {
    let total = 0;
    for (const v of pointsByPlayerMonth.get(pl.id)!.values()) total += v;
    seasonTotals.set(pl.id, total);
  }

  buildPronosticuriSheet(wb, matches, players, predByKey, seasonTotals, input.forPlayerId, now, input.revealAll ?? false);
  buildPeLuniSheet(wb, players, months, pointsByPlayerMonth);
  buildClasamentSheet(wb, matches, players, input.predictions);

  return wb;
}

function buildPronosticuriSheet(
  wb: ExcelJS.Workbook,
  matches: XlsxMatch[],
  players: XlsxPlayer[],
  predByKey: Map<string, XlsxPrediction>,
  seasonTotals: Map<string, number>,
  forPlayerId: string,
  now: Date,
  revealAll: boolean,
) {
  // Freeze the header AND the TOTAL row (first two rows).
  const ws = wb.addWorksheet('Pronosticuri', { views: [{ state: 'frozen', ySplit: 2 }] });

  // Column widths: Etapa, Data, Luna, Meci, Scor final, then one per player.
  ws.columns = [
    { width: 8 },
    { width: 16 },
    { width: 10 },
    { width: 34 },
    { width: 12 },
    ...players.map(() => ({ width: 14 })),
  ];

  // Header row.
  const headerValues = [
    'Etapa', 'Data', 'Luna', 'Meci', 'Scor final', ...players.map(displayName),
  ];
  const header = ws.addRow(headerValues);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = solidFill(HEADER_FILL);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  // TOTAL row: label in the Meci column, each player's season total in theirs.
  const totalValues: (string | number)[] = ['', '', '', 'TOTAL', ''];
  for (const pl of players) totalValues.push(seasonTotals.get(pl.id) ?? 0);
  const totalRow = ws.addRow(totalValues);
  const totalColCount = 5 + players.length;
  for (let c = 1; c <= totalColCount; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: c === 4 ? 'left' : 'center' };
  }

  for (const m of matches) {
    const locked = isLocked(m.kickoff_at, now);
    const rowValues: (string | number)[] = [
      m.round,
      formatKickoff(m.kickoff_at),
      monthLabel(monthKey(m.kickoff_at)),
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
      if (!revealAll && !locked && pl.id !== forPlayerId) {
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
      if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      const playerFill = colNumber >= 6 ? cellFills[colNumber - 6] : null;
      if (playerFill) cell.fill = solidFill(playerFill);
      else if (zebra) cell.fill = solidFill(ZEBRA_FILL);
    });
  }
}

function buildPeLuniSheet(
  wb: ExcelJS.Workbook,
  players: XlsxPlayer[],
  months: string[],
  pointsByPlayerMonth: Map<string, Map<string, number>>,
) {
  const ws = wb.addWorksheet('Pe luni', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ width: 14 }, ...players.map(() => ({ width: 14 }))];

  // Header: Luna, then one column per player (same order/names as sheet 1).
  const header = ws.addRow(['Luna', ...players.map(displayName)]);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = solidFill(HEADER_FILL);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });

  const totals = players.map(() => 0);

  for (const mk of months) {
    const monthPoints = players.map((pl) => pointsByPlayerMonth.get(pl.id)?.get(mk) ?? 0);
    const max = Math.max(...monthPoints);
    monthPoints.forEach((pts, i) => { totals[i] += pts; });

    const row = ws.addRow([monthLabel(mk), ...monthPoints]);
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
      // Highlight the month's leader(s); skip when nobody scored (all zeros).
      if (colNumber >= 2 && max > 0 && monthPoints[colNumber - 2] === max) {
        cell.fill = solidFill(EXACT_FILL);
      }
    });
  }

  // Season TOTAL row (bold).
  const totalRow = ws.addRow(['TOTAL', ...totals]);
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
  });
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

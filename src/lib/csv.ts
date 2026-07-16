// Pure CSV helpers for the game-database export.
// Romanian Excel expects the ';' separator; a UTF-8 BOM makes diacritics
// open correctly on double-click.

/** Column header of the export, in order. */
export const CSV_HEADER = [
  'Etapa', 'Data', 'Gazde', 'Oaspeti', 'Scor final', 'Jucator', 'Pronostic', 'Puncte',
] as const;

const BOM = '﻿';

/** Quote a field (and double its quotes) when it contains ';', '"' or a line break. */
export function csvEscape(field: string): string {
  if (/[;"\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Escape and join one row's fields with ';'. null/undefined become empty. */
export function csvRow(fields: ReadonlyArray<string | number | null | undefined>): string {
  return fields.map((f) => csvEscape(f == null ? '' : String(f))).join(';');
}

/** Assemble a full CSV document: BOM + header + rows, CRLF-terminated. */
export function buildCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
  header: ReadonlyArray<string> = CSV_HEADER,
): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return BOM + lines.join('\r\n') + '\r\n';
}

/** '2-1' for a played match, '' when either score is null/undefined. */
export function formatScore(home: number | null | undefined, away: number | null | undefined): string {
  if (home == null || away == null) return '';
  return `${home}-${away}`;
}

/** ISO instant -> 'DD.MM.YYYY HH:mm' in Europe/Bucharest local time. */
export function formatKickoff(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

// Romanian month names, index 0 = January.
const MONTHS_RO = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

/** '2026-07' — the YYYY-MM of the kickoff in Europe/Bucharest local time. */
export function monthKey(kickoffAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(kickoffAt));
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

/** '2026-07' -> 'Iulie'. Falls back to the key itself for an unknown month. */
export function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return MONTHS_RO[month - 1] ?? key;
}

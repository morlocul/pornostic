export type ScorePair = { home: number; away: number };

export function scorePrediction(pred: ScorePair, result: ScorePair): number {
  if (pred.home === result.home && pred.away === result.away) return 2;
  if (Math.sign(pred.home - pred.away) === Math.sign(result.home - result.away)) return 1;
  return 0;
}

export function isLocked(kickoffAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(kickoffAt).getTime();
}

export function currentRound(matches: { round: number; status: string }[]): number {
  const open = matches.filter((m) => m.status === 'scheduled');
  if (open.length) return Math.min(...open.map((m) => m.round));
  if (matches.length) return Math.max(...matches.map((m) => m.round));
  return 1;
}

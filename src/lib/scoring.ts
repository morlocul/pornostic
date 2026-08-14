export type ScorePair = { home: number; away: number };

export function scorePrediction(pred: ScorePair, result: ScorePair): number {
  if (pred.home === result.home && pred.away === result.away) return 2;
  if (Math.sign(pred.home - pred.away) === Math.sign(result.home - result.away)) return 1;
  return 0;
}

export const LOCK_MINUTES = 1; // pronosticurile se închid cu atâtea minute înainte de kickoff

export function isLocked(kickoffAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(kickoffAt).getTime() - LOCK_MINUTES * 60_000;
}

// True once the match has kicked off. Used to reveal everyone's predicted scores
// at the exact moment play starts (before that, only who-has-predicted is shown).
export function hasStarted(kickoffAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(kickoffAt).getTime();
}

const DAY_MS = 86_400_000;
// A match whose kickoff is more than this many days after the previous match in
// the round is treated as a far-postponed "straggler" (e.g. CFR–U Cluj moved to
// October, two months after the rest of round 4).
export const ROUND_OUTLIER_DAYS = 7;
// A straggler is hidden from the homepage until this many days before it's played.
export const OUTLIER_REVEAL_DAYS = 3;

// Split one round's matches (chronological) into those shown on the homepage now
// vs. far-postponed stragglers still waiting. A straggler is a match separated
// from the rest of the round by a >1-week gap; it stays "hidden" until
// OUTLIER_REVEAL_DAYS before kickoff, then moves to the homepage. Finished/live
// stragglers (kickoff in the past) are always "visible" — never on the wait list.
export function partitionRoundMatches<T extends { kickoff_at: string | Date }>(
  matches: T[],
  now: Date = new Date(),
): { visible: T[]; hidden: T[] } {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
  );
  const gapMs = ROUND_OUTLIER_DAYS * DAY_MS;
  const revealMs = OUTLIER_REVEAL_DAYS * DAY_MS;
  const visible: T[] = [];
  const hidden: T[] = [];
  let far = false;
  for (let i = 0; i < sorted.length; i++) {
    const k = new Date(sorted[i].kickoff_at).getTime();
    // Once a >1-week jump appears, this match and every later one are stragglers.
    if (i > 0 && k - new Date(sorted[i - 1].kickoff_at).getTime() > gapMs) far = true;
    if (!far || now.getTime() >= k - revealMs) visible.push(sorted[i]);
    else hidden.push(sorted[i]);
  }
  return { visible, hidden };
}

// One round's matches, chronological, with far-postponed stragglers hidden until
// OUTLIER_REVEAL_DAYS before their kickoff. Used on the homepage so a match that's
// two months away doesn't clutter the round that's actually being played now.
export function visibleRoundMatches<T extends { kickoff_at: string | Date }>(
  matches: T[],
  now: Date = new Date(),
): T[] {
  return partitionRoundMatches(matches, now).visible;
}

export function currentRound(
  matches: { round: number; status: string; kickoff_at?: string | null }[],
): number {
  // A live match keeps its round open/current, same as a scheduled one.
  const open = matches.filter((m) => m.status === 'scheduled' || m.status === 'live');
  if (open.length) {
    // The current round is the one being played NOW — i.e. the round of the open
    // match with the EARLIEST kickoff, not the lowest round number. Otherwise a
    // single postponed match (e.g. round 4's CFR–U Cluj moved to October) would
    // pin the app to an old round while a whole newer round is already underway.
    const withKick = open.filter((m) => m.kickoff_at);
    if (withKick.length) {
      const earliest = withKick.reduce((a, b) =>
        new Date(a.kickoff_at as string) <= new Date(b.kickoff_at as string) ? a : b,
      );
      return earliest.round;
    }
    return Math.min(...open.map((m) => m.round));
  }
  if (matches.length) return Math.max(...matches.map((m) => m.round));
  return 1;
}

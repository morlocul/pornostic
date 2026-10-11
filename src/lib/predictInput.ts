// Ce a scris jucătorul în cele două căsuțe ale unui meci.
// Un scor e complet doar când ambele căsuțe au 1-2 cifre.
export function parseScore(home: string, away: string): { home: number; away: number } | null {
  if (!/^\d{1,2}$/.test(home.trim()) || !/^\d{1,2}$/.test(away.trim())) return null;
  return { home: parseInt(home, 10), away: parseInt(away, 10) };
}

// Are ceva nesalvat: un scor complet diferit de cel salvat, sau o singură căsuță completată.
// Două căsuțe goale nu înseamnă nimic de salvat (pronosticul nu se șterge din formular).
export function isDirty(home: string, away: string, saved: { home: number; away: number } | null): boolean {
  const s = parseScore(home, away);
  if (!s) return home.trim() !== '' || away.trim() !== '';
  return !saved || s.home !== saved.home || s.away !== saved.away;
}

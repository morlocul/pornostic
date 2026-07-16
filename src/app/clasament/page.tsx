import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SEASON } from '@/lib/config';
import { monthKey, monthLabel } from '@/lib/months';

export const dynamic = 'force-dynamic';

export default async function Clasament({ searchParams }: { searchParams: Promise<{ luna?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { luna } = await searchParams;

  const { data: players } = await db().from('players').select('id, name');
  const { data: predData } = await db().from('predictions')
    .select('player_id, points, matches(kickoff_at, season)')
    .not('points', 'is', null);

  // The FK join resolves to a single match object at runtime (many-to-one).
  type PredRow = { player_id: string; points: number | null; matches: { kickoff_at: string; season: string } | null };
  const preds = (predData ?? []) as unknown as PredRow[];

  // Scored predictions on matches from the current season.
  const scored = preds.filter((p) => p.matches && p.matches.season === SEASON);

  // Month keys that actually have scored predictions, ascending.
  const monthKeys = [...new Set(scored.map((p) => monthKey(p.matches!.kickoff_at)))].sort();

  // Season over when no scheduled matches remain in the season.
  const { data: sched } = await db().from('matches')
    .select('id').eq('season', SEASON).eq('status', 'scheduled').limit(1);
  const seasonOver = (sched ?? []).length === 0;

  const activeLuna = luna && monthKeys.includes(luna) ? luna : null;
  const inPeriod = activeLuna
    ? scored.filter((p) => monthKey(p.matches!.kickoff_at) === activeLuna)
    : scored;

  const rows = (players ?? []).map((pl) => {
    const mine = inPeriod.filter((p) => p.player_id === pl.id);
    return {
      name: pl.name,
      points: mine.reduce((s, p) => s + (p.points ?? 0), 0),
      exact: mine.filter((p) => p.points === 2).length,
      correct: mine.filter((p) => p.points === 1).length,
    };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);

  const heading = activeLuna
    ? `Clasament — ${monthLabel(activeLuna)}`
    : seasonOver ? '🏆 Clasament final' : 'Clasament';

  return (
    <main>
      <h1>{heading}<a className="hist" href="/api/export" download>💾 Export CSV</a></h1>
      <div className="tabs">
        <Link className={!activeLuna ? 'active' : undefined} href="/clasament">Total sezon</Link>
        {monthKeys.map((k) => (
          <Link key={k} className={activeLuna === k ? 'active' : undefined} href={`/clasament?luna=${k}`}>
            {monthLabel(k)}
          </Link>
        ))}
      </div>
      <table>
        <thead><tr><th>#</th><th>Jucător</th><th className="num">Puncte</th><th className="num">Scor exact</th><th className="num">1X2</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td>{i + 1}</td>
              <td>{r.name}{r.name === session.name ? ' (tu)' : ''}</td>
              <td className="num"><strong>{r.points}</strong></td>
              <td className="num">{r.exact}</td>
              <td className="num">{r.correct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Clasament() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: players } = await db().from('players').select('id, name');
  const { data: preds } = await db().from('predictions').select('player_id, points').not('points', 'is', null);

  const rows = (players ?? []).map((pl) => {
    const mine = (preds ?? []).filter((p) => p.player_id === pl.id);
    return {
      name: pl.name,
      points: mine.reduce((s, p) => s + (p.points ?? 0), 0),
      exact: mine.filter((p) => p.points === 2).length,
      correct: mine.filter((p) => p.points === 1).length,
    };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);

  return (
    <main>
      <h1>Clasament</h1>
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

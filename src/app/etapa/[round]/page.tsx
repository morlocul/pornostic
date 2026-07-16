import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isLocked } from '@/lib/scoring';
import { SEASON } from '@/lib/config';
import GoalsList from '../../GoalsList';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export default async function Etapa({ params }: { params: Promise<{ round: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const round = parseInt((await params).round, 10);
  if (!Number.isInteger(round) || round < 1) redirect('/');

  const { data: matches } = await db().from('matches')
    .select('*').eq('season', SEASON).eq('round', round).order('kickoff_at');
  const ids = (matches ?? []).map((m) => m.id);
  const { data: preds } = ids.length
    ? await db().from('predictions').select('*, players(name, nickname)').in('match_id', ids)
    : { data: [] };

  return (
    <main>
      <h1>
        Etapa {round}
        <span>
          {round > 1 && <Link href={`/etapa/${round - 1}`}>← {round - 1}</Link>}{' '}
          <Link href={`/etapa/${round + 1}`}>{round + 1} →</Link>
        </span>
      </h1>
      {(matches ?? []).map((m: Match) => {
        const visible = isLocked(m.kickoff_at);
        const mPreds = (preds ?? []).filter((p) => p.match_id === m.id);
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span>{m.home_team}</span>
              <span className="vs">{m.status === 'finished' ? `${m.home_score} – ${m.away_score}` : m.status === 'postponed' ? (new Date(m.kickoff_at) > new Date() ? `Amânat până ${fmt.format(new Date(m.kickoff_at))}` : 'Amânat') : fmt.format(new Date(m.kickoff_at))}</span>
              <span>{m.away_team}</span>
            </div>
            {m.status === 'finished' && Array.isArray(m.goals) && m.goals.length > 0 && <GoalsList goals={m.goals} />}
            <div className="preds">
              {!visible && <p className="muted">Pronosticurile devin vizibile cu o oră înainte de meci.</p>}
              {visible && mPreds.length === 0 && <p className="muted">Niciun pronostic.</p>}
              {visible && mPreds.map((p) => (
                <p key={p.id} className={p.points === 2 ? 'ok' : undefined}>
                  {p.players.nickname ?? p.players.name}: {p.home_score}–{p.away_score}{p.points != null && ` (${p.points}p)`}
                </p>
              ))}
            </div>
          </div>
        );
      })}
      {(matches ?? []).length === 0 && <p>Nu există meciuri în etapa asta.</p>}
    </main>
  );
}

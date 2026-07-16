import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match, Prediction } from '@/lib/db';
import { getSession } from '@/lib/session';
import { currentRound, isLocked } from '@/lib/scoring';
import { SEASON } from '@/lib/config';
import PredictionForm from './PredictionForm';
import GoalsList from './GoalsList';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: allMatches } = await db().from('matches')
    .select('id, round, status').eq('season', SEASON);
  const round = currentRound(allMatches ?? []);

  const { data: matches } = await db().from('matches')
    .select('*').eq('season', SEASON).eq('round', round).order('kickoff_at');
  const matchIds = (matches ?? []).map((m) => m.id);

  const { data: preds } = matchIds.length
    ? await db().from('predictions').select('*, players(name, nickname)').in('match_id', matchIds)
    : { data: [] as (Prediction & { players: { name: string; nickname: string | null } })[] };

  const mine = new Map((preds ?? []).filter((p) => p.player_id === session.playerId).map((p) => [p.match_id, p]));

  return (
    <main>
      <h1>Etapa {round} <Link className="hist" href={`/etapa/${round}`}>istoric →</Link></h1>
      <p className="notice">⏰ Pronosticurile se închid cu o oră înainte de fiecare meci.</p>
      {(matches ?? []).length === 0 && <p>Nu există meciuri încă. Adminul poate rula scraperul din pagina Admin.</p>}
      {(matches ?? []).map((m: Match) => {
        const canPredict = m.status === 'scheduled' && !isLocked(m.kickoff_at);
        const showOthers = isLocked(m.kickoff_at);
        const my = mine.get(m.id);
        const others = (preds ?? []).filter((p) => p.match_id === m.id && p.player_id !== session.playerId);
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span>{m.home_team}</span>
              <span className="vs">{m.status === 'finished' ? `${m.home_score} – ${m.away_score}` : fmt.format(new Date(m.kickoff_at))}</span>
              <span>{m.away_team}</span>
            </div>
            {m.status === 'postponed' && (
              <p className="muted">
                {new Date(m.kickoff_at) > new Date() ? `Amânat până ${fmt.format(new Date(m.kickoff_at))}` : 'Amânat — dată nouă în curând'}
              </p>
            )}
            {m.status === 'finished' && Array.isArray(m.goals) && m.goals.length > 0 && <GoalsList goals={m.goals} />}
            {canPredict && <PredictionForm matchId={m.id} initialHome={my?.home_score ?? null} initialAway={my?.away_score ?? null} />}
            {showOthers && (
              <div className="preds">
                <p>{my ? `Tu: ${my.home_score}–${my.away_score}` : 'Tu: fără pronostic'}{my?.points != null && ` (${my.points}p)`}</p>
                {others.map((p) => (
                  <p key={p.id} className="muted">{p.players.nickname ?? p.players.name}: {p.home_score}–{p.away_score}{p.points != null && ` (${p.points}p)`}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match, Prediction } from '@/lib/db';
import { getSession } from '@/lib/session';
import { currentRound, isLocked, visibleRoundMatches } from '@/lib/scoring';
import { SEASON, SHOW_ALL_PREDICTIONS } from '@/lib/config';
import PredictionForm from './PredictionForm';
import GoalsList from './GoalsList';
import TeamLogo from './TeamLogo';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: allMatches } = await db().from('matches')
    .select('id, round, status, kickoff_at').eq('season', SEASON);
  const round = currentRound(allMatches ?? []);

  const { data: roundMatches } = await db().from('matches')
    .select('*').eq('season', SEASON).eq('round', round).order('kickoff_at');
  // Hide far-postponed stragglers (e.g. a match moved 2 months out) until 3 days
  // before they're played, so the homepage shows the round as it's actually played.
  const matches = visibleRoundMatches(roundMatches ?? []);
  const matchIds = matches.map((m) => m.id);

  const { data: preds } = matchIds.length
    ? await db().from('predictions').select('*, players(name, nickname)').in('match_id', matchIds)
    : { data: [] as (Prediction & { players: { name: string; nickname: string | null } })[] };

  const mine = new Map((preds ?? []).filter((p) => p.player_id === session.playerId).map((p) => [p.match_id, p]));

  return (
    <main>
      <h1>Etapa {round} <Link className="hist" href={`/etapa/${round}`}>istoric →</Link></h1>
      <p className="notice">⏰ Pronosticurile se pot modifica până chiar înainte de începerea fiecărui meci.</p>
      {(matches ?? []).length === 0 && <p>Nu există meciuri încă. Adminul poate rula scraperul din pagina Admin.</p>}
      {(matches ?? []).map((m: Match) => {
        const canPredict = m.status === 'scheduled' && !isLocked(m.kickoff_at);
        const showOthers = SHOW_ALL_PREDICTIONS || isLocked(m.kickoff_at);
        const my = mine.get(m.id);
        const others = (preds ?? []).filter((p) => p.match_id === m.id && p.player_id !== session.playerId);
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span className="team home">
                <TeamLogo compId={m.home_comp_id} name={m.home_team} />
                <span className="tname">{m.home_team}</span>
              </span>
              <span className="vs">{m.status === 'finished' || m.status === 'live' ? `${m.home_score} – ${m.away_score}` : fmt.format(new Date(m.kickoff_at))}</span>
              <span className="team away">
                <span className="tname">{m.away_team}</span>
                <TeamLogo compId={m.away_comp_id} name={m.away_team} />
              </span>
            </div>
            {m.status === 'live' && (
              <div className="live-badge">LIVE{m.live_minute ? ` ${m.live_minute}` : ''}</div>
            )}
            {m.status === 'postponed' && (
              <p className="muted">
                {new Date(m.kickoff_at) > new Date() ? `Amânat până ${fmt.format(new Date(m.kickoff_at))}` : 'Amânat — dată nouă în curând'}
              </p>
            )}
            {(m.status === 'finished' || m.status === 'live') && Array.isArray(m.goals) && m.goals.length > 0 && <GoalsList goals={m.goals} />}
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

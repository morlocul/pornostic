import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match } from '@/lib/db';
import { getSession } from '@/lib/session';
import { hasStarted } from '@/lib/scoring';
import { SEASON, SHOW_ALL_PREDICTIONS } from '@/lib/config';
import GoalsList from '../../GoalsList';
import TeamLogo from '../../TeamLogo';

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
  const { data: roster } = await db().from('players').select('id, name, nickname').order('created_at');
  const players = roster ?? [];

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
        const revealScores = SHOW_ALL_PREDICTIONS || m.status === 'live' || m.status === 'finished' || hasStarted(m.kickoff_at);
        const mPreds = (preds ?? []).filter((p) => p.match_id === m.id);
        const predictedIds = new Set(mPreds.map((p) => p.player_id));
        const missing = players.filter((pl) => !predictedIds.has(pl.id));
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span className="team home">
                <TeamLogo compId={m.home_comp_id} name={m.home_team} />
                <span className="tname">{m.home_team}</span>
              </span>
              <span className="vs">{m.status === 'finished' || m.status === 'live' ? `${m.home_score} – ${m.away_score}` : m.status === 'postponed' ? (new Date(m.kickoff_at) > new Date() ? `Amânat până ${fmt.format(new Date(m.kickoff_at))}` : 'Amânat') : fmt.format(new Date(m.kickoff_at))}</span>
              <span className="team away">
                <span className="tname">{m.away_team}</span>
                <TeamLogo compId={m.away_comp_id} name={m.away_team} />
              </span>
            </div>
            {m.status === 'live' && (
              <div className="live-badge">LIVE{m.live_minute ? ` ${m.live_minute}` : ''}</div>
            )}
            {(m.status === 'finished' || m.status === 'live') && Array.isArray(m.goals) && m.goals.length > 0 && <GoalsList goals={m.goals} />}
            <div className="preds">
              {!revealScores && <p className="muted">Scorurile se dezvăluie la începerea meciului. Până atunci se vede doar cine a pus.</p>}
              {revealScores && mPreds.length === 0 && <p className="muted">Niciun pronostic.</p>}
              {revealScores && mPreds.map((p) => (
                <p key={p.id} className={p.points === 2 ? 'ok' : undefined}>
                  {p.players.nickname ?? p.players.name}: {p.home_score}–{p.away_score}{p.points != null && ` (${p.points}p)`}
                </p>
              ))}
              {!revealScores && mPreds.map((p) => (
                <p key={p.id} className="muted">{p.players.nickname ?? p.players.name}: ✓ a pus</p>
              ))}
              {!revealScores && missing.map((pl) => (
                <p key={pl.id} className="muted pending">{pl.nickname ?? pl.name}: ⏳ n-a pus încă</p>
              ))}
            </div>
          </div>
        );
      })}
      {(matches ?? []).length === 0 && <p>Nu există meciuri în etapa asta.</p>}
    </main>
  );
}

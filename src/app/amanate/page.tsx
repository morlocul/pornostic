import { redirect } from 'next/navigation';
import { db, Match } from '@/lib/db';
import { getSession } from '@/lib/session';
import { partitionRoundMatches, OUTLIER_REVEAL_DAYS } from '@/lib/scoring';
import { SEASON } from '@/lib/config';
import TeamLogo from '../TeamLogo';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export default async function Amanate() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: all } = await db().from('matches')
    .select('*').eq('season', SEASON).order('kickoff_at');

  // Group by round, then keep only the far-postponed stragglers still waiting.
  const byRound = new Map<number, Match[]>();
  for (const m of all ?? []) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  const now = new Date();
  const waiting: Match[] = [];
  for (const arr of byRound.values()) {
    waiting.push(...partitionRoundMatches(arr, now).hidden);
  }
  waiting.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  return (
    <main>
      <h1>Meciuri amânate</h1>
      <p className="notice">
        ⏳ Meciuri mutate mult față de restul etapei. Fiecare revine automat pe prima
        pagină cu {OUTLIER_REVEAL_DAYS} zile înainte de disputare, ca să puteți pronostica.
      </p>
      {waiting.length === 0 && <p>Niciun meci amânat momentan. 🎉</p>}
      {waiting.map((m: Match) => (
        <div className="card" key={m.id}>
          <div className="teams">
            <span className="team home">
              <TeamLogo compId={m.home_comp_id} name={m.home_team} />
              <span className="tname">{m.home_team}</span>
            </span>
            <span className="vs">{fmt.format(new Date(m.kickoff_at))}</span>
            <span className="team away">
              <span className="tname">{m.away_team}</span>
              <TeamLogo compId={m.away_comp_id} name={m.away_team} />
            </span>
          </div>
          <p className="muted">Etapa {m.round}</p>
        </div>
      ))}
    </main>
  );
}

import { MatchGoal } from '@/lib/db';

const suffix = (kind: MatchGoal['kind']) =>
  kind === 'penalty' ? ' (pen.)' : kind === 'own_goal' ? ' (a.g.)' : '';

function Scorer({ g }: { g: MatchGoal }) {
  return (
    <span>
      <b className="min">{g.min}</b> {g.player}
      {suffix(g.kind)}
    </span>
  );
}

export default function GoalsList({ goals }: { goals: MatchGoal[] }) {
  if (!goals.length) return null;
  const home = goals.filter((g) => g.side === 'home');
  const away = goals.filter((g) => g.side === 'away');
  return (
    <div className="goals">
      <div className="goals-col goals-home">
        {home.map((g, i) => (
          <Scorer key={i} g={g} />
        ))}
      </div>
      <div className="goals-col goals-away">
        {away.map((g, i) => (
          <Scorer key={i} g={g} />
        ))}
      </div>
    </div>
  );
}

import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SEASON } from '@/lib/config';
import { buildCsv, formatKickoff, formatScore } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// One CSV row per prediction (joined to its match + player), plus one row per
// match that has no predictions at all. Any logged-in player may export.
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const [{ data: matchData }, { data: predData }] = await Promise.all([
    db().from('matches')
      .select('id, round, kickoff_at, home_team, away_team, home_score, away_score')
      .eq('season', SEASON),
    db().from('predictions')
      .select('match_id, home_score, away_score, points, players(name)'),
  ]);

  type MatchRow = {
    id: string; round: number; kickoff_at: string;
    home_team: string; away_team: string;
    home_score: number | null; away_score: number | null;
  };
  // The FK join resolves to a single player object at runtime (many-to-one).
  type PredRow = {
    match_id: string; home_score: number; away_score: number;
    points: number | null; players: { name: string } | null;
  };

  const matches = (matchData ?? []) as MatchRow[];
  const preds = (predData ?? []) as unknown as PredRow[];

  const predsByMatch = new Map<string, PredRow[]>();
  for (const p of preds) {
    const list = predsByMatch.get(p.match_id);
    if (list) list.push(p);
    else predsByMatch.set(p.match_id, [p]);
  }

  type OutRow = {
    round: number; kickoff: string; playerName: string;
    fields: (string | number | null)[];
  };
  const out: OutRow[] = [];

  for (const m of matches) {
    const data = formatKickoff(m.kickoff_at);
    const finalScore = formatScore(m.home_score, m.away_score);
    const mine = predsByMatch.get(m.id) ?? [];

    if (mine.length === 0) {
      out.push({
        round: m.round, kickoff: m.kickoff_at, playerName: '',
        fields: [m.round, data, m.home_team, m.away_team, finalScore, '', '', ''],
      });
    } else {
      for (const p of mine) {
        const playerName = p.players?.name ?? '';
        out.push({
          round: m.round, kickoff: m.kickoff_at, playerName,
          fields: [
            m.round, data, m.home_team, m.away_team, finalScore,
            playerName, formatScore(p.home_score, p.away_score),
            p.points == null ? '' : p.points,
          ],
        });
      }
    }
  }

  // Sort: round asc, kickoff asc, player name asc.
  out.sort((a, b) =>
    a.round - b.round ||
    a.kickoff.localeCompare(b.kickoff) ||
    a.playerName.localeCompare(b.playerName, 'ro'),
  );

  const csv = buildCsv(out.map((r) => r.fields));

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pornosticul-export.csv"',
    },
  });
}

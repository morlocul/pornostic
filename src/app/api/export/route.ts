import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SEASON } from '@/lib/config';
import { buildExportWorkbook, type XlsxMatch, type XlsxPrediction, type XlsxPlayer } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

// Formatted Excel export of the whole game database for the current season.
// Any logged-in player may export; predictions on matches that are not yet
// locked are hidden from everyone except the requesting player (see builder).
export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const [{ data: matchData }, { data: predData }, { data: playerData }] = await Promise.all([
    db().from('matches')
      .select('id, round, kickoff_at, home_team, away_team, home_score, away_score')
      .eq('season', SEASON),
    db().from('predictions')
      .select('match_id, player_id, home_score, away_score, points'),
    db().from('players').select('id, name, nickname'),
  ]);

  const matches = (matchData ?? []) as XlsxMatch[];
  const predictions = (predData ?? []) as XlsxPrediction[];
  const players = (playerData ?? []) as XlsxPlayer[];

  const wb = await buildExportWorkbook({
    matches,
    predictions,
    players,
    forPlayerId: session.playerId,
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="pornosticul-export.xlsx"',
    },
  });
}

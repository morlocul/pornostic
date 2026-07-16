export type FetchedMatch = {
  round: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string; // ISO UTC
  status: 'scheduled' | 'finished' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
  sourceGameId?: number;
};

export interface ScrapeSource {
  name: string;
  fetchSeason(): Promise<FetchedMatch[]>;
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Player = {
  id: string; name: string; nickname: string | null; pin_hash: string; is_admin: boolean; created_at: string;
};
export type MatchGoal = {
  min: string;            // minute display incl. added time, e.g. "19'" or "45'+2"
  player: string;         // scorer name, or 'necunoscut' when unresolved
  side: 'home' | 'away';  // competitor whose player scored (own goals keep this side)
  kind: 'goal' | 'penalty' | 'own_goal';
};
export type Match = {
  id: string; season: string; round: number;
  home_team: string; away_team: string; home_key: string; away_key: string;
  kickoff_at: string; status: 'scheduled' | 'live' | 'finished' | 'postponed';
  live_minute: string | null;     // in-play display, e.g. "67'" or "Halftime"; null off-play
  home_score: number | null; away_score: number | null;
  source: 'scraper' | 'manual'; locked_manual: boolean;
  goals: MatchGoal[] | null;      // null = never fetched; [] = fetched, 0-0
  source_game_id: number | null;  // 365Scores game id
  home_comp_id: number | null;    // 365Scores home competitor id (for logo)
  away_comp_id: number | null;    // 365Scores away competitor id (for logo)
};
export type Prediction = {
  id: string; player_id: string; match_id: string;
  home_score: number; away_score: number; points: number | null; updated_at: string;
};

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

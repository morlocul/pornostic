import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Player = {
  id: string; name: string; pin_hash: string; is_admin: boolean; created_at: string;
};
export type Match = {
  id: string; season: string; round: number;
  home_team: string; away_team: string; home_key: string; away_key: string;
  kickoff_at: string; status: 'scheduled' | 'finished' | 'postponed';
  home_score: number | null; away_score: number | null;
  source: 'scraper' | 'manual'; locked_manual: boolean;
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

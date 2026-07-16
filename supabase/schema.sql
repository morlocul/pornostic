create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  nickname text,
  pin_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
-- Self-chosen display name ("Poreclă"); case-insensitive unique, violation code 23505.
create unique index players_nickname_lower_idx on players (lower(nickname));

create table matches (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  round int not null,
  home_team text not null,
  away_team text not null,
  home_key text not null,
  away_key text not null,
  kickoff_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','finished','postponed')),
  home_score int,
  away_score int,
  source text not null default 'scraper' check (source in ('scraper','manual')),
  locked_manual boolean not null default false,
  unique (season, round, home_key)
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_score int not null,
  away_score int not null,
  points int,
  updated_at timestamptz not null default now(),
  unique (player_id, match_id)
);

create table scrape_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  source text not null,
  ok boolean not null,
  message text,
  upserted int not null default 0
);

-- Service-role key bypasses RLS; enabling RLS with no policies blocks the anon key entirely.
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table scrape_runs enable row level security;

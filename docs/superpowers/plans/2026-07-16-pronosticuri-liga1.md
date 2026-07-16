# Pronosticuri Liga 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Every implementation subagent must invoke the `fable-mindset` skill at the start of its task, before touching code.

**Goal:** Web app where a small group of friends predict exact scores for Romanian SuperLiga matches; the app scrapes fixtures/results and keeps a season-long leaderboard.

**Architecture:** Single Next.js (App Router, TypeScript) project on Vercel. Supabase Postgres accessed ONLY server-side via service-role key (no RLS policies needed; RLS enabled with no policies to block anon access). Custom name+PIN auth with a signed JWT session cookie. Scraper is an isolated module with two source adapters (Sofascore primary, TheSportsDB fallback) triggered by a cron-protected API route; manual admin override always wins.

**Tech Stack:** Next.js 15 (App Router), TypeScript, plain CSS (no Tailwind), @supabase/supabase-js v2, jose (JWT), bcryptjs (PIN hash), vitest (tests).

**Spec:** `docs/superpowers/specs/2026-07-16-pronosticuri-liga1-design.md`. One deliberate simplification vs. spec: no `rounds` table — the current round is derived from `matches` (see Task 3).

## Global Constraints

- Language of ALL UI text: **Romanian**. Dates/times displayed in `Europe/Bucharest` timezone.
- Scoring: correct 1X2 = **1 point**; exact score = **2 points total**; otherwise 0. No prediction = 0.
- Predictions rejected **server-side** at/after kickoff.
- PIN: exactly 4 digits, stored only as bcrypt hash. Player name: unique, 2–20 chars.
- First registered player becomes admin (`is_admin = true`).
- Season constant: `2026-27`. Sofascore: unique-tournament `152`, season `97124`. TheSportsDB: league `4691`, season string `2026-2027`.
- Scraper must NEVER overwrite a match row where `locked_manual = true`.
- Env vars (server-only, never NEXT_PUBLIC): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `CRON_SECRET`.
- All external fetches happen server-side. No client ever talks to Supabase or the football sources directly.
- Tests: vitest, colocated `*.test.ts` next to source. Run with `npx vitest run`.
- Commit after every task (message prefix `feat:`/`test:`/`chore:`).

## File Structure

```
package.json / tsconfig.json / next.config.ts / vitest.config.ts / vercel.json / .env.example
supabase/schema.sql              — full DB schema, pasted into Supabase SQL editor
src/lib/config.ts                — season + source IDs constants
src/lib/db.ts                    — Supabase server client (service role)
src/lib/session.ts               — JWT cookie session helpers
src/lib/scoring.ts               — scorePrediction, isLocked, currentRound (pure, tested)
src/lib/teams.ts                 — normalizeTeam (pure, tested)
src/lib/recompute.ts             — recompute points for finished matches
src/scraper/types.ts             — FetchedMatch + ScrapeSource interface
src/scraper/sofascore.ts         — adapter (parse fn pure, tested on fixtures)
src/scraper/thesportsdb.ts       — adapter (parse fn pure, tested on fixtures)
src/scraper/index.ts             — runScrape: cascade sources, upsert, log
src/app/api/auth/register/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/predictions/route.ts — POST, enforces kickoff lock
src/app/api/admin/matches/route.ts
src/app/api/admin/scrape/route.ts
src/app/api/cron/scrape/route.ts
src/app/layout.tsx, src/app/globals.css
src/app/login/page.tsx + src/app/login/LoginForm.tsx
src/app/page.tsx                 — current round + predictions
src/app/PredictionForm.tsx       — client component
src/app/clasament/page.tsx
src/app/etapa/[round]/page.tsx
src/app/admin/page.tsx + src/app/admin/AdminPanel.tsx
tests/fixtures/sofascore-events.json
tests/fixtures/tsdb-round.json
public/manifest.json, public/icon.svg, public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
scripts/make-icons.mjs
.github/workflows/scrape.yml
README.md
```

---

### Task 1: Project scaffold + vitest

**Files:**
- Create: Next.js scaffold at repo root, `vitest.config.ts`, `.env.example`, `src/lib/config.ts`

**Interfaces:**
- Produces: `src/lib/config.ts` exporting `SEASON`, `SOFA_TOURNAMENT`, `SOFA_SEASON`, `TSDB_LEAGUE`, `TSDB_SEASON` — used by scraper and pages.

- [ ] **Step 1: Scaffold Next.js in the existing repo root**

Run (repo root `G:\PRONOSTIC APP`):
```powershell
npx create-next-app@latest . --ts --app --no-tailwind --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
If it complains the directory is not empty (docs/ exists), scaffold into a temp dir and move contents up:
```powershell
npx create-next-app@latest tmp-app --ts --app --no-tailwind --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack
Get-ChildItem tmp-app -Force | Move-Item -Destination . -Force
Remove-Item tmp-app -Recurse -Force
```

- [ ] **Step 2: Install runtime + dev dependencies**

```powershell
npm install @supabase/supabase-js jose bcryptjs
npm install -D vitest @types/bcryptjs sharp
```

- [ ] **Step 3: Add vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
});
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Add config constants**

`src/lib/config.ts`:
```ts
export const SEASON = '2026-27';
export const SOFA_TOURNAMENT = 152;
export const SOFA_SEASON = 97124;
export const TSDB_LEAGUE = 4691;
export const TSDB_SEASON = '2026-2027';
```

- [ ] **Step 5: Add `.env.example`**

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=any-long-random-string-min-32-chars
CRON_SECRET=another-long-random-string
```
Ensure `.gitignore` contains `.env*` (create-next-app adds `.env*` by default — verify).

- [ ] **Step 6: Verify build and empty test run**

Run: `npm run build` → Expected: compiles successfully.
Run: `npx vitest run` → Expected: "No test files found" exit 0 (or passes once tests exist).

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "chore: scaffold Next.js app with vitest"
```

---

### Task 2: Database schema + Supabase server client

**Files:**
- Create: `supabase/schema.sql`, `src/lib/db.ts`

**Interfaces:**
- Produces: `db()` returning a `SupabaseClient`; tables `players`, `matches`, `predictions`, `scrape_runs` with the exact columns below. Row types `Player`, `Match`, `Prediction` exported from `src/lib/db.ts`.

- [ ] **Step 1: Write schema**

`supabase/schema.sql`:
```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

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
```

- [ ] **Step 2: Write DB client + row types**

`src/lib/db.ts`:
```ts
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
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "feat: add DB schema and Supabase server client"
```

**Note for the human operator (done once, before Task 9 can be verified live):** create a free project at supabase.com, paste `supabase/schema.sql` into SQL Editor → Run, copy Project URL + service_role key into `.env.local`.

---

### Task 3: Scoring rules (pure functions, TDD)

**Files:**
- Create: `src/lib/scoring.ts`, `src/lib/scoring.test.ts`

**Interfaces:**
- Produces:
  - `scorePrediction(pred: ScorePair, result: ScorePair): number` (0 | 1 | 2)
  - `isLocked(kickoffAt: string | Date, now?: Date): boolean`
  - `currentRound(matches: { round: number; status: string }[]): number`
  - `type ScorePair = { home: number; away: number }`

- [ ] **Step 1: Write failing tests**

`src/lib/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scorePrediction, isLocked, currentRound } from './scoring';

describe('scorePrediction', () => {
  it('exact score = 2 points', () => {
    expect(scorePrediction({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(2);
    expect(scorePrediction({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(2);
  });
  it('correct 1X2 but wrong score = 1 point', () => {
    expect(scorePrediction({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe(1); // home win
    expect(scorePrediction({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1); // draw
    expect(scorePrediction({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(1); // away win
  });
  it('wrong outcome = 0 points', () => {
    expect(scorePrediction({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0);
    expect(scorePrediction({ home: 1, away: 1 }, { home: 1, away: 0 })).toBe(0);
    expect(scorePrediction({ home: 0, away: 1 }, { home: 1, away: 1 })).toBe(0);
  });
});

describe('isLocked', () => {
  const kickoff = '2026-07-20T18:00:00Z';
  it('open before kickoff', () => {
    expect(isLocked(kickoff, new Date('2026-07-20T17:59:59Z'))).toBe(false);
  });
  it('locked at and after kickoff', () => {
    expect(isLocked(kickoff, new Date('2026-07-20T18:00:00Z'))).toBe(true);
    expect(isLocked(kickoff, new Date('2026-07-21T00:00:00Z'))).toBe(true);
  });
});

describe('currentRound', () => {
  it('is the lowest round with a scheduled match', () => {
    expect(currentRound([
      { round: 1, status: 'finished' }, { round: 2, status: 'finished' },
      { round: 2, status: 'scheduled' }, { round: 3, status: 'scheduled' },
    ])).toBe(2);
  });
  it('falls back to the highest round when everything finished', () => {
    expect(currentRound([
      { round: 1, status: 'finished' }, { round: 2, status: 'finished' },
    ])).toBe(2);
  });
  it('ignores postponed matches', () => {
    expect(currentRound([
      { round: 1, status: 'postponed' }, { round: 3, status: 'scheduled' },
    ])).toBe(3);
  });
  it('returns 1 for empty list', () => {
    expect(currentRound([])).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Implement**

`src/lib/scoring.ts`:
```ts
export type ScorePair = { home: number; away: number };

export function scorePrediction(pred: ScorePair, result: ScorePair): number {
  if (pred.home === result.home && pred.away === result.away) return 2;
  if (Math.sign(pred.home - pred.away) === Math.sign(result.home - result.away)) return 1;
  return 0;
}

export function isLocked(kickoffAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(kickoffAt).getTime();
}

export function currentRound(matches: { round: number; status: string }[]): number {
  const open = matches.filter((m) => m.status === 'scheduled');
  if (open.length) return Math.min(...open.map((m) => m.round));
  if (matches.length) return Math.max(...matches.map((m) => m.round));
  return 1;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/lib/scoring.test.ts` → Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: scoring rules (1X2=1p, exact=2p), kickoff lock, current round"
```

---

### Task 4: Team name normalization (pure, TDD)

**Files:**
- Create: `src/lib/teams.ts`, `src/lib/teams.test.ts`

**Interfaces:**
- Produces: `normalizeTeam(name: string): string` — stable key so the same club from different sources maps to the same `home_key`/`away_key`.

- [ ] **Step 1: Write failing tests**

`src/lib/teams.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeTeam } from './teams';

describe('normalizeTeam', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeTeam('FC Botoșani')).toBe('botosani');
    expect(normalizeTeam('Botosani')).toBe('botosani');
  });
  it('drops generic club prefixes but keeps identity words', () => {
    expect(normalizeTeam('CS Universitatea Craiova')).toBe('universitatea craiova');
    expect(normalizeTeam('CFR Cluj')).toBe('cfr cluj'); // cfr is identity, not dropped
    expect(normalizeTeam('FCSB')).toBe('fcsb');         // single token, not a prefix
  });
  it('maps known aliases across sources', () => {
    expect(normalizeTeam('U Cluj')).toBe('universitatea cluj');
    expect(normalizeTeam('Universitatea Cluj')).toBe('universitatea cluj');
  });
  it('collapses punctuation and whitespace', () => {
    expect(normalizeTeam('  A.F.C.  Hermannstadt ')).toBe('hermannstadt');
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run src/lib/teams.test.ts` → Expected: FAIL — cannot resolve `./teams`.

- [ ] **Step 3: Implement**

`src/lib/teams.ts`:
```ts
const DROP = new Set(['fc', 'afc', 'acs', 'cs', 'csm', 'sc', 'club', 'fotbal', 'ac', 'as']);
const ALIASES: Record<string, string> = {
  'u cluj': 'universitatea cluj',
  'poli iasi': 'politehnica iasi',
  'u craiova': 'universitatea craiova',
};

export function normalizeTeam(name: string): string {
  let s = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = s.split(' ').filter((t) => !DROP.has(t));
  s = tokens.join(' ') || s; // never return empty (e.g. name was just "FC")
  return ALIASES[s] ?? s;
}
```
Note: `A.F.C.` becomes `a f c` after punctuation stripping — tokens `a`,`f`,`c` are not in DROP. Fix: strip periods to NOTHING (not space) before the general cleanup:
```ts
  let s = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\./g, '');
  s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
```
`A.F.C.` → `afc` → dropped. Use this version.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/lib/teams.test.ts` → Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A; git commit -m "feat: team name normalization for cross-source matching"
```

---

### Task 5: Scraper adapters + orchestrator

**Files:**
- Create: `src/scraper/types.ts`, `src/scraper/sofascore.ts`, `src/scraper/thesportsdb.ts`, `src/scraper/index.ts`
- Create: `tests/fixtures/sofascore-events.json`, `tests/fixtures/tsdb-round.json`
- Create: `src/scraper/parse.test.ts`

**Interfaces:**
- Consumes: `normalizeTeam` (Task 4), `SEASON`/IDs from `config.ts` (Task 1), `db()` (Task 2).
- Produces:
  - `type FetchedMatch = { round: number; homeTeam: string; awayTeam: string; kickoffAt: string; status: 'scheduled'|'finished'|'postponed'; homeScore: number|null; awayScore: number|null }`
  - `parseSofascoreEvents(json: unknown): FetchedMatch[]`
  - `parseTsdbEvents(json: unknown): FetchedMatch[]`
  - `runScrape(): Promise<{ ok: boolean; source: string; upserted: number; message: string }>` — used by cron + admin routes. Also recomputes points at the end (via Task 8's `recomputePoints`; wire that call in Task 8).

- [ ] **Step 1: Write types**

`src/scraper/types.ts`:
```ts
export type FetchedMatch = {
  round: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string; // ISO UTC
  status: 'scheduled' | 'finished' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
};

export interface ScrapeSource {
  name: string;
  fetchSeason(): Promise<FetchedMatch[]>;
}
```

- [ ] **Step 2: Create test fixtures**

`tests/fixtures/sofascore-events.json` (trimmed real shape — two events, one finished one scheduled):
```json
{
  "events": [
    {
      "id": 11111111,
      "roundInfo": { "round": 1 },
      "homeTeam": { "name": "Metaloglobus" },
      "awayTeam": { "name": "U Cluj" },
      "startTimestamp": 1752249600,
      "status": { "code": 100, "type": "finished", "description": "Ended" },
      "homeScore": { "current": 1 },
      "awayScore": { "current": 4 }
    },
    {
      "id": 22222222,
      "roundInfo": { "round": 1 },
      "homeTeam": { "name": "FC Voluntari" },
      "awayTeam": { "name": "FC Botoșani" },
      "startTimestamp": 1784302200,
      "status": { "code": 0, "type": "notstarted", "description": "Not started" },
      "homeScore": {},
      "awayScore": {}
    }
  ]
}
```

`tests/fixtures/tsdb-round.json`:
```json
{
  "events": [
    {
      "idEvent": "3333333",
      "strHomeTeam": "Metaloglobus București",
      "strAwayTeam": "Universitatea Cluj",
      "intHomeScore": "1",
      "intAwayScore": "4",
      "intRound": "1",
      "strStatus": "FT",
      "strTimestamp": "2025-07-11T16:00:00"
    },
    {
      "idEvent": "4444444",
      "strHomeTeam": "FC Voluntari",
      "strAwayTeam": "FC Botosani",
      "intHomeScore": null,
      "intAwayScore": null,
      "intRound": "1",
      "strStatus": "NS",
      "strTimestamp": "2026-07-17T18:30:00"
    }
  ]
}
```

- [ ] **Step 3: Write failing parser tests**

`src/scraper/parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseSofascoreEvents } from './sofascore';
import { parseTsdbEvents } from './thesportsdb';

const fixture = (f: string) =>
  JSON.parse(readFileSync(path.resolve(__dirname, '../../tests/fixtures', f), 'utf8'));

describe('parseSofascoreEvents', () => {
  const parsed = () => parseSofascoreEvents(fixture('sofascore-events.json'));
  it('maps a finished match', () => {
    const m = parsed()[0];
    expect(m).toEqual({
      round: 1, homeTeam: 'Metaloglobus', awayTeam: 'U Cluj',
      kickoffAt: new Date(1752249600 * 1000).toISOString(),
      status: 'finished', homeScore: 1, awayScore: 4,
    });
  });
  it('maps a not-started match with null scores', () => {
    const m = parsed()[1];
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeNull();
    expect(m.awayScore).toBeNull();
  });
});

describe('parseTsdbEvents', () => {
  const parsed = () => parseTsdbEvents(fixture('tsdb-round.json'));
  it('maps a finished match with numeric scores', () => {
    const m = parsed()[0];
    expect(m.round).toBe(1);
    expect(m.status).toBe('finished');
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(4);
    expect(m.kickoffAt).toBe('2025-07-11T16:00:00.000Z'); // strTimestamp treated as UTC
  });
  it('maps a not-started match', () => {
    const m = parsed()[1];
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeNull();
  });
  it('tolerates a null events payload', () => {
    expect(parseTsdbEvents({ events: null })).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests, verify fail**

Run: `npx vitest run src/scraper/parse.test.ts` → Expected: FAIL — modules not found.

- [ ] **Step 5: Implement Sofascore adapter**

`src/scraper/sofascore.ts`:
```ts
import { SOFA_TOURNAMENT, SOFA_SEASON } from '@/lib/config';
import { FetchedMatch, ScrapeSource } from './types';

const BASE = `https://api.sofascore.com/api/v1/unique-tournament/${SOFA_TOURNAMENT}/season/${SOFA_SEASON}/events`;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

type SofaEvent = {
  roundInfo?: { round?: number };
  homeTeam: { name: string };
  awayTeam: { name: string };
  startTimestamp: number;
  status: { type: string };
  homeScore: { current?: number };
  awayScore: { current?: number };
};

export function parseSofascoreEvents(json: unknown): FetchedMatch[] {
  const events = ((json as { events?: SofaEvent[] })?.events ?? []).filter(Boolean);
  return events
    .filter((e) => e.roundInfo?.round != null)
    .map((e) => {
      const finished = e.status.type === 'finished';
      const postponed = e.status.type === 'postponed' || e.status.type === 'canceled';
      return {
        round: e.roundInfo!.round!,
        homeTeam: e.homeTeam.name,
        awayTeam: e.awayTeam.name,
        kickoffAt: new Date(e.startTimestamp * 1000).toISOString(),
        status: finished ? 'finished' : postponed ? 'postponed' : 'scheduled',
        homeScore: finished ? (e.homeScore.current ?? null) : null,
        awayScore: finished ? (e.awayScore.current ?? null) : null,
      } as FetchedMatch;
    });
}

async function fetchPages(kind: 'last' | 'next'): Promise<FetchedMatch[]> {
  const out: FetchedMatch[] = [];
  for (let page = 0; page < 12; page++) {
    const res = await fetch(`${BASE}/${kind}/${page}`, { headers: HEADERS, cache: 'no-store' });
    if (res.status === 404) break; // past the last page
    if (!res.ok) throw new Error(`sofascore ${kind}/${page}: HTTP ${res.status}`);
    const json = await res.json();
    out.push(...parseSofascoreEvents(json));
    if (!(json as { hasNextPage?: boolean }).hasNextPage) break;
  }
  return out;
}

export const sofascore: ScrapeSource = {
  name: 'sofascore',
  async fetchSeason() {
    const [finished, upcoming] = await Promise.all([fetchPages('last'), fetchPages('next')]);
    return [...finished, ...upcoming];
  },
};
```

- [ ] **Step 6: Implement TheSportsDB adapter**

`src/scraper/thesportsdb.ts`:
```ts
import { TSDB_LEAGUE, TSDB_SEASON } from '@/lib/config';
import { FetchedMatch, ScrapeSource } from './types';

type TsdbEvent = {
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intRound: string;
  strStatus: string | null;
  strTimestamp: string | null;
};

export function parseTsdbEvents(json: unknown): FetchedMatch[] {
  const events = ((json as { events?: TsdbEvent[] | null })?.events ?? []) || [];
  return events
    .filter((e) => e && e.strTimestamp && e.intRound)
    .map((e) => {
      const finished = e.strStatus === 'FT' || (e.intHomeScore != null && e.intAwayScore != null);
      const postponed = e.strStatus === 'POST' || e.strStatus === 'CANC';
      return {
        round: parseInt(e.intRound, 10),
        homeTeam: e.strHomeTeam,
        awayTeam: e.strAwayTeam,
        kickoffAt: new Date(e.strTimestamp + 'Z').toISOString(), // TSDB timestamps are UTC without zone suffix
        status: finished ? 'finished' : postponed ? 'postponed' : 'scheduled',
        homeScore: finished && e.intHomeScore != null ? parseInt(e.intHomeScore, 10) : null,
        awayScore: finished && e.intAwayScore != null ? parseInt(e.intAwayScore, 10) : null,
      } as FetchedMatch;
    });
}

export const thesportsdb: ScrapeSource = {
  name: 'thesportsdb',
  async fetchSeason() {
    const out: FetchedMatch[] = [];
    // Free key truncates big responses — fetch per round. SuperLiga regular season = 30 rounds.
    for (let r = 1; r <= 30; r++) {
      const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${TSDB_LEAGUE}&r=${r}&s=${TSDB_SEASON}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`thesportsdb r${r}: HTTP ${res.status}`);
      out.push(...parseTsdbEvents(await res.json()));
    }
    return out;
  },
};
```

- [ ] **Step 7: Run parser tests, verify pass**

Run: `npx vitest run src/scraper/parse.test.ts` → Expected: all PASS.

- [ ] **Step 8: Implement orchestrator (cascade + upsert + log)**

`src/scraper/index.ts`:
```ts
import { db } from '@/lib/db';
import { SEASON } from '@/lib/config';
import { normalizeTeam } from '@/lib/teams';
import { FetchedMatch, ScrapeSource } from './types';
import { sofascore } from './sofascore';
import { thesportsdb } from './thesportsdb';

const SOURCES: ScrapeSource[] = [sofascore, thesportsdb];

async function upsertMatches(fetched: FetchedMatch[]): Promise<number> {
  if (!fetched.length) return 0;
  const { data: locked, error: lockErr } = await db()
    .from('matches')
    .select('round, home_key')
    .eq('season', SEASON)
    .eq('locked_manual', true);
  if (lockErr) throw new Error(lockErr.message);
  const lockedSet = new Set((locked ?? []).map((m) => `${m.round}|${m.home_key}`));

  const rows = fetched
    .map((m) => ({
      season: SEASON,
      round: m.round,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
      home_key: normalizeTeam(m.homeTeam),
      away_key: normalizeTeam(m.awayTeam),
      kickoff_at: m.kickoffAt,
      status: m.status,
      home_score: m.homeScore,
      away_score: m.awayScore,
      source: 'scraper' as const,
    }))
    .filter((r) => !lockedSet.has(`${r.round}|${r.home_key}`));

  // Dedupe within the batch (same match can appear on two pages) — Postgres
  // rejects an upsert that touches the same row twice in one statement.
  const unique = new Map(rows.map((r) => [`${r.round}|${r.home_key}`, r]));
  const deduped = [...unique.values()];

  if (!deduped.length) return 0;
  const { error } = await db()
    .from('matches')
    .upsert(deduped, { onConflict: 'season,round,home_key' });
  if (error) throw new Error(error.message);
  return deduped.length;
}

export async function runScrape(): Promise<{ ok: boolean; source: string; upserted: number; message: string }> {
  for (const source of SOURCES) {
    try {
      const fetched = await source.fetchSeason();
      if (!fetched.length) throw new Error('0 matches returned');
      const upserted = await upsertMatches(fetched);
      const result = { ok: true, source: source.name, upserted, message: `ok: ${fetched.length} fetched, ${upserted} upserted` };
      await db().from('scrape_runs').insert({ source: source.name, ok: true, message: result.message, upserted });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db().from('scrape_runs').insert({ source: source.name, ok: false, message, upserted: 0 });
      // fall through to next source
    }
  }
  return { ok: false, source: 'none', upserted: 0, message: 'toate sursele au eșuat' };
}
```

- [ ] **Step 9: Typecheck and full test run**

Run: `npx tsc --noEmit; npx vitest run` → Expected: no type errors, all tests PASS.

- [ ] **Step 10: Commit**

```powershell
git add -A; git commit -m "feat: scraper with Sofascore primary + TheSportsDB fallback"
```

---

### Task 6: Auth — session helpers, register/login/logout, login page

**Files:**
- Create: `src/lib/session.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`

**Interfaces:**
- Consumes: `db()`, `Player` (Task 2).
- Produces:
  - `type Session = { playerId: string; name: string; isAdmin: boolean }`
  - `getSession(): Promise<Session | null>` — reads the `session` cookie; used by every page/route.
  - `sessionCookie(session: Session): Promise<{ name: string; value: string; options: object }>`
  - POST `/api/auth/register` `{ name, pin }` → 200 `{ ok: true }` + cookie; 409 if name taken.
  - POST `/api/auth/login` `{ name, pin }` → 200 + cookie; 401 on bad credentials.
  - POST `/api/auth/logout` → clears cookie.

- [ ] **Step 1: Session helpers**

`src/lib/session.ts`:
```ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type Session = { playerId: string; name: string; isAdmin: boolean };

const COOKIE = 'session';
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function createSessionToken(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('180d')
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { playerId: payload.playerId as string, name: payload.name as string, isAdmin: !!payload.isAdmin };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 180 * 24 * 3600,
  };
}
export const SESSION_COOKIE = COOKIE;
```

- [ ] **Step 2: Register route**

`src/app/api/auth/register/route.ts`:
```ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, cookieOptions, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20)
    return NextResponse.json({ error: 'Numele trebuie să aibă 2–20 de caractere.' }, { status: 400 });
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin))
    return NextResponse.json({ error: 'PIN-ul trebuie să aibă exact 4 cifre.' }, { status: 400 });

  const cleanName = name.trim();
  const { count } = await db().from('players').select('*', { count: 'exact', head: true });
  const isFirst = (count ?? 0) === 0;

  const { data, error } = await db()
    .from('players')
    .insert({ name: cleanName, pin_hash: await bcrypt.hash(pin, 10), is_admin: isFirst })
    .select()
    .single();
  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'Numele este deja luat.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ playerId: data.id, name: data.name, isAdmin: data.is_admin }), cookieOptions());
  return res;
}
```

- [ ] **Step 3: Login route**

`src/app/api/auth/login/route.ts`:
```ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSessionToken, cookieOptions, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const { name, pin } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || typeof pin !== 'string')
    return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 });

  const { data: player } = await db().from('players').select('*').eq('name', name.trim()).single();
  if (!player || !(await bcrypt.compare(pin, player.pin_hash)))
    return NextResponse.json({ error: 'Nume sau PIN greșit.' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ playerId: player.id, name: player.name, isAdmin: player.is_admin }), cookieOptions());
  return res;
}
```

- [ ] **Step 4: Logout route**

`src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 5: Login page (server wrapper + client form)**

`src/app/login/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return <LoginForm />;
}
```

`src/app/login/LoginForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    });
    setBusy(false);
    if (res.ok) { router.push('/'); router.refresh(); }
    else setError((await res.json()).error ?? 'Eroare.');
  }

  return (
    <main className="auth">
      <h1>⚽ Pronosticuri Liga 1</h1>
      <div className="tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Intră</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Înscrie-te</button>
      </div>
      <form onSubmit={submit}>
        <input placeholder="Numele tău" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={20} />
        <input placeholder="PIN (4 cifre)" value={pin} onChange={(e) => setPin(e.target.value)} required inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{mode === 'login' ? 'Intră' : 'Creează cont'}</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit; npm run build` → Expected: clean.

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "feat: name+PIN auth with JWT session cookie"
```

---

### Task 7: Current round page + prediction API

**Files:**
- Create: `src/app/api/predictions/route.ts`, `src/app/PredictionForm.tsx`
- Modify: `src/app/page.tsx` (replace scaffold), `src/app/layout.tsx`, `src/app/globals.css` (replace scaffold)

**Interfaces:**
- Consumes: `getSession`, `db()`, `Match`/`Prediction` types, `isLocked`, `currentRound`.
- Produces: POST `/api/predictions` `{ matchId: string, home: number, away: number }` → 200 `{ ok: true }`; 401 no session; 403 `{ error }` if locked; 400 invalid.

- [ ] **Step 1: Prediction API with kickoff lock**

`src/app/api/predictions/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isLocked } from '@/lib/scoring';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 });

  const { matchId, home, away } = await req.json().catch(() => ({}));
  const valid = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20;
  if (typeof matchId !== 'string' || !valid(home) || !valid(away))
    return NextResponse.json({ error: 'Pronostic invalid.' }, { status: 400 });

  const { data: match } = await db().from('matches').select('*').eq('id', matchId).single();
  if (!match) return NextResponse.json({ error: 'Meci inexistent.' }, { status: 404 });
  if (isLocked(match.kickoff_at))
    return NextResponse.json({ error: 'Meciul a început — pronosticul e blocat.' }, { status: 403 });

  const { error } = await db().from('predictions').upsert(
    { player_id: session.playerId, match_id: matchId, home_score: home, away_score: away, points: null, updated_at: new Date().toISOString() },
    { onConflict: 'player_id,match_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Layout with nav**

`src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pronosticuri Liga 1',
  manifest: '/manifest.json',
  icons: { apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0f1b2d' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="ro">
      <body>
        {session && (
          <nav>
            <Link href="/">Etapa</Link>
            <Link href="/clasament">Clasament</Link>
            {session.isAdmin && <Link href="/admin">Admin</Link>}
            <span className="who">{session.name}</span>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Current round page (server component)**

`src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match, Prediction } from '@/lib/db';
import { getSession } from '@/lib/session';
import { currentRound, isLocked } from '@/lib/scoring';
import { SEASON } from '@/lib/config';
import PredictionForm from './PredictionForm';

export const dynamic = 'force-dynamic';

const fmt = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: allMatches } = await db().from('matches')
    .select('id, round, status').eq('season', SEASON);
  const round = currentRound(allMatches ?? []);

  const { data: matches } = await db().from('matches')
    .select('*').eq('season', SEASON).eq('round', round).order('kickoff_at');
  const matchIds = (matches ?? []).map((m) => m.id);

  const { data: preds } = matchIds.length
    ? await db().from('predictions').select('*, players(name)').in('match_id', matchIds)
    : { data: [] as (Prediction & { players: { name: string } })[] };

  const mine = new Map((preds ?? []).filter((p) => p.player_id === session.playerId).map((p) => [p.match_id, p]));

  return (
    <main>
      <h1>Etapa {round} <Link className="hist" href={`/etapa/${round}`}>istoric →</Link></h1>
      {(matches ?? []).length === 0 && <p>Nu există meciuri încă. Adminul poate rula scraperul din pagina Admin.</p>}
      {(matches ?? []).map((m: Match) => {
        const locked = isLocked(m.kickoff_at) || m.status !== 'scheduled';
        const my = mine.get(m.id);
        const others = (preds ?? []).filter((p) => p.match_id === m.id && p.player_id !== session.playerId);
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span>{m.home_team}</span>
              <span className="vs">{m.status === 'finished' ? `${m.home_score} – ${m.away_score}` : fmt.format(new Date(m.kickoff_at))}</span>
              <span>{m.away_team}</span>
            </div>
            {m.status === 'postponed' && <p className="muted">Amânat</p>}
            {!locked && <PredictionForm matchId={m.id} initialHome={my?.home_score ?? null} initialAway={my?.away_score ?? null} />}
            {locked && (
              <div className="preds">
                <p>{my ? `Tu: ${my.home_score}–${my.away_score}` : 'Tu: fără pronostic'}{my?.points != null && ` (${my.points}p)`}</p>
                {others.map((p) => (
                  <p key={p.id} className="muted">{p.players.name}: {p.home_score}–{p.away_score}{p.points != null && ` (${p.points}p)`}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 4: Prediction form (client)**

`src/app/PredictionForm.tsx`:
```tsx
'use client';
import { useState } from 'react';

export default function PredictionForm({ matchId, initialHome, initialAway }:
  { matchId: string; initialHome: number | null; initialAway: number | null }) {
  const [home, setHome] = useState(initialHome?.toString() ?? '');
  const [away, setAway] = useState(initialAway?.toString() ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>(initialHome != null ? 'saved' : 'idle');
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, home: parseInt(home, 10), away: parseInt(away, 10) }),
    });
    if (res.ok) setState('saved');
    else { setState('error'); setMsg((await res.json()).error ?? 'Eroare.'); }
  }

  const onChange = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value); if (state === 'saved') setState('idle');
  };

  return (
    <form className="predict" onSubmit={save}>
      <input inputMode="numeric" pattern="\d{1,2}" value={home} onChange={onChange(setHome)} required aria-label="scor gazde" />
      <span>–</span>
      <input inputMode="numeric" pattern="\d{1,2}" value={away} onChange={onChange(setAway)} required aria-label="scor oaspeți" />
      <button disabled={state === 'busy'}>{state === 'saved' ? 'Salvat ✓' : 'Salvează'}</button>
      {state === 'error' && <span className="error">{msg}</span>}
    </form>
  );
}
```

- [ ] **Step 5: Global styles (replace scaffold `globals.css`)**

`src/app/globals.css`:
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg: #0f1b2d; --card: #18293f; --text: #e8eef6; --muted: #8ea3bc; --accent: #ffb703; --ok: #4caf50; --err: #ef5350; }
body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; }
main { max-width: 560px; margin: 0 auto; padding: 16px; }
h1 { font-size: 1.3rem; margin: 12px 0 16px; display: flex; justify-content: space-between; align-items: baseline; }
h1 .hist { font-size: 0.85rem; }
nav { display: flex; gap: 16px; padding: 12px 16px; background: var(--card); align-items: center; }
nav a { color: var(--accent); text-decoration: none; font-weight: 600; }
nav .who { margin-left: auto; color: var(--muted); }
a { color: var(--accent); }
.card { background: var(--card); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.teams { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
.teams span:first-child { text-align: right; }
.vs { color: var(--muted); font-size: 0.8rem; text-align: center; white-space: nowrap; }
.teams span { font-size: 0.95rem; }
.predict { display: flex; gap: 8px; margin-top: 10px; justify-content: center; align-items: center; }
.predict input { width: 52px; text-align: center; font-size: 1.1rem; padding: 8px; border-radius: 8px; border: 1px solid var(--muted); background: var(--bg); color: var(--text); }
.predict button, .auth button, .admin button { padding: 8px 14px; border-radius: 8px; border: none; background: var(--accent); color: #222; font-weight: 700; cursor: pointer; }
.predict button:disabled { opacity: 0.6; }
.preds { margin-top: 10px; text-align: center; font-size: 0.9rem; }
.muted { color: var(--muted); }
.error { color: var(--err); font-size: 0.85rem; }
.auth { display: flex; flex-direction: column; gap: 16px; margin-top: 15vh; text-align: center; }
.auth form { display: flex; flex-direction: column; gap: 12px; }
.auth input { padding: 12px; border-radius: 8px; border: 1px solid var(--muted); background: var(--card); color: var(--text); font-size: 1rem; text-align: center; }
.tabs { display: flex; gap: 8px; justify-content: center; }
.tabs button { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--muted); background: transparent; color: var(--text); cursor: pointer; }
.tabs button.active { background: var(--accent); color: #222; border-color: var(--accent); font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px; text-align: left; border-bottom: 1px solid #2a3d57; }
td.num, th.num { text-align: right; }
.admin .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.admin input, .admin select { padding: 6px; border-radius: 6px; border: 1px solid var(--muted); background: var(--bg); color: var(--text); }
.admin input.score { width: 44px; text-align: center; }
.ok { color: var(--ok); }
```
Also delete `src/app/page.module.css` if the scaffold created it.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit; npm run build` → Expected: clean.

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "feat: current round page with kickoff-locked predictions"
```

---

### Task 8: Points recompute + leaderboard + round history

**Files:**
- Create: `src/lib/recompute.ts`, `src/app/clasament/page.tsx`, `src/app/etapa/[round]/page.tsx`
- Modify: `src/scraper/index.ts` (call recompute after successful scrape)

**Interfaces:**
- Consumes: `scorePrediction`, `db()`.
- Produces: `recomputePoints(): Promise<number>` — sets `predictions.points` for every prediction on a finished match (and nulls points on non-finished ones); returns number of predictions updated. Used by scraper + admin routes.

- [ ] **Step 1: Implement recompute**

`src/lib/recompute.ts`:
```ts
import { db, Match, Prediction } from '@/lib/db';
import { scorePrediction } from '@/lib/scoring';
import { SEASON } from '@/lib/config';

export async function recomputePoints(): Promise<number> {
  const { data: matches, error: mErr } = await db()
    .from('matches').select('*').eq('season', SEASON);
  if (mErr) throw new Error(mErr.message);
  const byId = new Map((matches ?? []).map((m: Match) => [m.id, m]));

  const { data: preds, error: pErr } = await db().from('predictions').select('*');
  if (pErr) throw new Error(pErr.message);

  let updated = 0;
  for (const p of (preds ?? []) as Prediction[]) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    const scoreable = m.status === 'finished' && m.home_score != null && m.away_score != null;
    const points = scoreable
      ? scorePrediction({ home: p.home_score, away: p.away_score }, { home: m.home_score!, away: m.away_score! })
      : null;
    if (points !== p.points) {
      const { error } = await db().from('predictions').update({ points }).eq('id', p.id);
      if (error) throw new Error(error.message);
      updated++;
    }
  }
  return updated;
}
```

- [ ] **Step 2: Wire recompute into scraper**

Modify `src/scraper/index.ts` — add import and call after a successful upsert, inside the `try` right before `return result;`:
```ts
import { recomputePoints } from '@/lib/recompute';
// ... in runScrape, after `await db().from('scrape_runs').insert(...)`:
      await recomputePoints();
      return result;
```

- [ ] **Step 3: Leaderboard page**

`src/app/clasament/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Clasament() {
  const session = await getSession();
  if (!session) redirect('/login');

  const { data: players } = await db().from('players').select('id, name');
  const { data: preds } = await db().from('predictions').select('player_id, points').not('points', 'is', null);

  const rows = (players ?? []).map((pl) => {
    const mine = (preds ?? []).filter((p) => p.player_id === pl.id);
    return {
      name: pl.name,
      points: mine.reduce((s, p) => s + (p.points ?? 0), 0),
      exact: mine.filter((p) => p.points === 2).length,
      correct: mine.filter((p) => p.points === 1).length,
    };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact);

  return (
    <main>
      <h1>Clasament</h1>
      <table>
        <thead><tr><th>#</th><th>Jucător</th><th className="num">Puncte</th><th className="num">Scor exact</th><th className="num">1X2</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td>{i + 1}</td>
              <td>{r.name}{r.name === session.name ? ' (tu)' : ''}</td>
              <td className="num"><strong>{r.points}</strong></td>
              <td className="num">{r.exact}</td>
              <td className="num">{r.correct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Round history page**

`src/app/etapa/[round]/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, Match } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isLocked } from '@/lib/scoring';
import { SEASON } from '@/lib/config';

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
    ? await db().from('predictions').select('*, players(name)').in('match_id', ids)
    : { data: [] };

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
        const visible = isLocked(m.kickoff_at);
        const mPreds = (preds ?? []).filter((p) => p.match_id === m.id);
        return (
          <div className="card" key={m.id}>
            <div className="teams">
              <span>{m.home_team}</span>
              <span className="vs">{m.status === 'finished' ? `${m.home_score} – ${m.away_score}` : m.status === 'postponed' ? 'Amânat' : fmt.format(new Date(m.kickoff_at))}</span>
              <span>{m.away_team}</span>
            </div>
            <div className="preds">
              {!visible && <p className="muted">Pronosticurile devin vizibile la începerea meciului.</p>}
              {visible && mPreds.length === 0 && <p className="muted">Niciun pronostic.</p>}
              {visible && mPreds.map((p) => (
                <p key={p.id} className={p.points === 2 ? 'ok' : undefined}>
                  {p.players.name}: {p.home_score}–{p.away_score}{p.points != null && ` (${p.points}p)`}
                </p>
              ))}
            </div>
          </div>
        );
      })}
      {(matches ?? []).length === 0 && <p>Nu există meciuri în etapa asta.</p>}
    </main>
  );
}
```

- [ ] **Step 5: Typecheck + full tests + build**

Run: `npx tsc --noEmit; npx vitest run; npm run build` → Expected: clean, all PASS.

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: points recompute, leaderboard, round history"
```

---

### Task 9: Admin panel + admin/cron API routes + schedulers

**Files:**
- Create: `src/app/api/admin/matches/route.ts`, `src/app/api/admin/scrape/route.ts`, `src/app/api/cron/scrape/route.ts`, `src/app/admin/page.tsx`, `src/app/admin/AdminPanel.tsx`, `vercel.json`, `.github/workflows/scrape.yml`

**Interfaces:**
- Consumes: `getSession` (checks `isAdmin`), `runScrape`, `recomputePoints`, `normalizeTeam`, `SEASON`.
- Produces:
  - POST `/api/admin/matches` — body either `{ id, home_score, away_score, status, locked_manual, kickoff_at? }` (update) or `{ create: true, round, home_team, away_team, kickoff_at }` (create). Recomputes points after update. 403 if not admin.
  - POST `/api/admin/scrape` → runs `runScrape()`, returns its result. 403 if not admin.
  - GET `/api/cron/scrape` with header `Authorization: Bearer <CRON_SECRET>` → runs `runScrape()`.

- [ ] **Step 1: Admin matches route**

`src/app/api/admin/matches/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { recomputePoints } from '@/lib/recompute';
import { normalizeTeam } from '@/lib/teams';
import { SEASON } from '@/lib/config';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Doar adminul.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.create) {
    const { round, home_team, away_team, kickoff_at } = body;
    if (!Number.isInteger(round) || !home_team || !away_team || !kickoff_at)
      return NextResponse.json({ error: 'Date incomplete.' }, { status: 400 });
    const { error } = await db().from('matches').insert({
      season: SEASON, round, home_team, away_team,
      home_key: normalizeTeam(home_team), away_key: normalizeTeam(away_team),
      kickoff_at, source: 'manual', locked_manual: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { id, home_score, away_score, status, locked_manual, kickoff_at } = body;
  if (typeof id !== 'string') return NextResponse.json({ error: 'ID lipsă.' }, { status: 400 });
  const patch: Record<string, unknown> = { source: 'manual' };
  if (home_score !== undefined) patch.home_score = home_score;
  if (away_score !== undefined) patch.away_score = away_score;
  if (status !== undefined) patch.status = status;
  if (locked_manual !== undefined) patch.locked_manual = locked_manual;
  if (kickoff_at !== undefined) patch.kickoff_at = kickoff_at;
  const { error } = await db().from('matches').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recomputePoints();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Admin scrape route**

`src/app/api/admin/scrape/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runScrape } from '@/scraper';

export async function POST() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ error: 'Doar adminul.' }, { status: 403 });
  return NextResponse.json(await runScrape());
}
```

- [ ] **Step 3: Cron route**

`src/app/api/cron/scrape/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { runScrape } from '@/scraper';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await runScrape());
}
```

- [ ] **Step 4: Admin page (server) + panel (client)**

`src/app/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { SEASON } from '@/lib/config';
import AdminPanel from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/');

  const { data: matches } = await db().from('matches')
    .select('*').eq('season', SEASON).order('round').order('kickoff_at');
  const { data: runs } = await db().from('scrape_runs')
    .select('*').order('ran_at', { ascending: false }).limit(10);

  return <AdminPanel matches={matches ?? []} runs={runs ?? []} />;
}
```

`src/app/admin/AdminPanel.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Match } from '@/lib/db';

type Run = { id: number; ran_at: string; source: string; ok: boolean; message: string | null; upserted: number };

function MatchRow({ m, onSaved }: { m: Match; onSaved: () => void }) {
  const [home, setHome] = useState(m.home_score?.toString() ?? '');
  const [away, setAway] = useState(m.away_score?.toString() ?? '');
  const [status, setStatus] = useState(m.status);
  const [locked, setLocked] = useState(m.locked_manual);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch('/api/admin/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: m.id,
        home_score: home === '' ? null : parseInt(home, 10),
        away_score: away === '' ? null : parseInt(away, 10),
        status, locked_manual: locked,
      }),
    });
    setBusy(false); onSaved();
  }

  return (
    <div className="row">
      <span style={{ minWidth: 30 }}>E{m.round}</span>
      <span style={{ flex: 1 }}>{m.home_team} – {m.away_team}</span>
      <input className="score" value={home} onChange={(e) => setHome(e.target.value)} placeholder="-" />
      <input className="score" value={away} onChange={(e) => setAway(e.target.value)} placeholder="-" />
      <select value={status} onChange={(e) => setStatus(e.target.value as Match['status'])}>
        <option value="scheduled">programat</option>
        <option value="finished">jucat</option>
        <option value="postponed">amânat</option>
      </select>
      <label><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> fixat</label>
      <button onClick={save} disabled={busy}>Salvează</button>
    </div>
  );
}

export default function AdminPanel({ matches, runs }: { matches: Match[]; runs: Run[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [nm, setNm] = useState({ round: '', home: '', away: '', kickoff: '' });
  const rounds = [...new Set(matches.map((m) => m.round))];
  const [shownRound, setShownRound] = useState<number | null>(rounds[0] ?? null);

  async function runScraper() {
    setMsg('Rulează…');
    const res = await fetch('/api/admin/scrape', { method: 'POST' });
    const j = await res.json();
    setMsg(`${j.ok ? '✔' : '✖'} ${j.source}: ${j.message}`);
    router.refresh();
  }

  async function addMatch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        create: true, round: parseInt(nm.round, 10), home_team: nm.home, away_team: nm.away,
        kickoff_at: new Date(nm.kickoff).toISOString(),
      }),
    });
    if (res.ok) { setNm({ round: '', home: '', away: '', kickoff: '' }); router.refresh(); }
    else setMsg((await res.json()).error ?? 'Eroare.');
  }

  return (
    <main className="admin">
      <h1>Admin</h1>
      <div className="row">
        <button onClick={runScraper}>Rulează scraperul acum</button>
        {msg && <span className="muted">{msg}</span>}
      </div>

      <h2>Meciuri</h2>
      <div className="row">
        <select value={shownRound ?? ''} onChange={(e) => setShownRound(parseInt(e.target.value, 10))}>
          {rounds.map((r) => <option key={r} value={r}>Etapa {r}</option>)}
        </select>
      </div>
      {matches.filter((m) => m.round === shownRound).map((m) => (
        <MatchRow key={m.id} m={m} onSaved={() => router.refresh()} />
      ))}

      <h2>Adaugă meci manual</h2>
      <form className="row" onSubmit={addMatch}>
        <input style={{ width: 60 }} placeholder="Etapa" value={nm.round} onChange={(e) => setNm({ ...nm, round: e.target.value })} required />
        <input placeholder="Gazde" value={nm.home} onChange={(e) => setNm({ ...nm, home: e.target.value })} required />
        <input placeholder="Oaspeți" value={nm.away} onChange={(e) => setNm({ ...nm, away: e.target.value })} required />
        <input type="datetime-local" value={nm.kickoff} onChange={(e) => setNm({ ...nm, kickoff: e.target.value })} required />
        <button type="submit">Adaugă</button>
      </form>

      <h2>Ultimele rulări scraper</h2>
      {runs.map((r) => (
        <p key={r.id} className={r.ok ? 'ok' : 'error'}>
          {new Date(r.ran_at).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })} — {r.source}: {r.message} ({r.upserted})
        </p>
      ))}
    </main>
  );
}
```
Note: `new Date(nm.kickoff).toISOString()` interprets the datetime-local value in the ADMIN's browser timezone — correct behavior since the admin thinks in local (Romanian) time.

- [ ] **Step 5: Vercel cron (daily backup) + GitHub Actions (frequent)**

`vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/scrape", "schedule": "0 8 * * *" }]
}
```
(Vercel Hobby allows only daily crons; Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` env var is set on the project.)

`.github/workflows/scrape.yml` (primary scheduler — every 30 min in the afternoon/evening window, Romanian match hours):
```yaml
name: scrape
on:
  schedule:
    - cron: '0,30 10-21 * * *'  # every 30 min, 10:00–21:30 UTC (13:00–00:30 Romania)
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sf -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ vars.APP_URL }}/api/cron/scrape"
```
(Repo needs secret `CRON_SECRET` and variable `APP_URL` set — covered in README, Task 11.)

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit; npm run build` → Expected: clean.

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "feat: admin panel, cron endpoint, schedulers"
```

---

### Task 10: PWA (manifest + icons)

**Files:**
- Create: `public/manifest.json`, `public/icon.svg`, `scripts/make-icons.mjs`
- Generated: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

- [ ] **Step 1: Icon source**

`public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f1b2d"/>
  <circle cx="256" cy="230" r="120" fill="#e8eef6"/>
  <path d="M256 150l38 28-15 45h-46l-15-45z" fill="#0f1b2d"/>
  <text x="256" y="440" font-family="system-ui,sans-serif" font-size="88" font-weight="800" fill="#ffb703" text-anchor="middle">LIGA 1</text>
</svg>
```

- [ ] **Step 2: Icon generation script**

`scripts/make-icons.mjs`:
```js
import sharp from 'sharp';
const src = 'public/icon.svg';
await sharp(src).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(src).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(src).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons generated');
```
Run: `node scripts/make-icons.mjs` → Expected: "icons generated", 3 PNGs in `public/`.

- [ ] **Step 3: Manifest**

`public/manifest.json`:
```json
{
  "name": "Pronosticuri Liga 1",
  "short_name": "Pronosticuri",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1b2d",
  "theme_color": "#0f1b2d",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```
(`layout.tsx` from Task 7 already references `manifest` and `apple-touch-icon`.)

- [ ] **Step 4: Build check + commit**

Run: `npm run build` → Expected: clean.
```powershell
git add -A; git commit -m "feat: PWA manifest and icons"
```

---

### Task 11: README + deploy guide + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md` (content in Romanian, exact steps):
```markdown
# ⚽ Pronosticuri Liga 1

Aplicație de pronosticuri pentru SuperLiga României, pentru un grup de prieteni.
Punctaj: 1X2 corect = 1 punct, scor exact = 2 puncte.

## Rulare locală

1. `npm install`
2. Creează un proiect gratuit pe [supabase.com](https://supabase.com) → SQL Editor → rulează conținutul din `supabase/schema.sql`.
3. Copiază `.env.example` în `.env.local` și completează:
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — din Supabase: Settings → API (folosește cheia `service_role`, NU `anon`).
   - `SESSION_SECRET`, `CRON_SECRET` — orice șiruri aleatorii lungi (`openssl rand -hex 32` sau [random.org](https://random.org)).
4. `npm run dev` → http://localhost:3000
5. Înscrie-te — **primul cont creat devine admin**.
6. Din pagina Admin, apasă „Rulează scraperul acum" ca să populezi meciurile.

## Deploy pe Vercel (gratuit)

1. Urcă repo-ul pe GitHub.
2. [vercel.com](https://vercel.com) → Add New Project → importă repo-ul → Framework: Next.js (auto).
3. La Environment Variables adaugă toate cele 4 variabile din `.env.local`.
4. Deploy. Primești un URL gen `https://pronosticuri.vercel.app` — trimite-l prietenilor.
5. Cron zilnic Vercel: e deja configurat în `vercel.json` (rulează la 08:00 UTC).

## Scraper des (GitHub Actions, gratuit)

În repo pe GitHub → Settings:
- Secrets and variables → Actions → **Secrets** → `CRON_SECRET` = aceeași valoare ca pe Vercel.
- Secrets and variables → Actions → **Variables** → `APP_URL` = URL-ul Vercel (fără slash final).

Workflow-ul `.github/workflows/scrape.yml` rulează la fiecare 30 min (10:00–21:30 UTC). Îl poți porni și manual din tab-ul Actions.

## Dacă scraperul dă 403 (Sofascore blochează Vercel)

Aplicația trece automat pe TheSportsDB. Dacă și acela e incomplet, adaugă/corectează meciurile din pagina **Admin** — tot ce e „fixat" manual nu mai e atins de scraper.

## Teste

`npm test`
```

- [ ] **Step 2: Full local verification (needs a real Supabase project + `.env.local`)**

Manual smoke checklist, run `npm run dev` and verify in the browser:
1. Register `TestAdmin` + PIN → lands on Etapa page, nav shows Admin link.
2. Register second user `TestUser` in an incognito window → no Admin link.
3. Admin → „Rulează scraperul acum" → matches appear (or a red error row in scrape runs if sources blocked — then add one match manually with kickoff 1h in the future).
4. On Etapa page, save a prediction 2–1 → button shows „Salvat ✓"; reload → values persist.
5. Admin: set that match `status=jucat`, score 2–1, save → Clasament shows 2 points for that player.
6. Admin: set kickoff of another match in the past (or wait) → prediction form replaced by everyone's predictions.
7. `npx vitest run` → all PASS. `npm run build` → clean.

- [ ] **Step 3: Commit**

```powershell
git add -A; git commit -m "docs: README with local run and deploy guide"
```

- [ ] **Step 4: Deploy (with the human operator)**

Follow README: push to GitHub, import into Vercel, set env vars, set GitHub secret/variable, verify the deployed URL end-to-end (register, predict, admin scrape). **Critical test on production:** does Sofascore return 200 from Vercel's IPs? Check the „Ultimele rulări scraper" list in Admin — if source shows `thesportsdb` or errors, Sofascore is blocked and the fallback is doing its job.
```
